import os
import unittest
from unittest.mock import patch

os.environ["CLASSIFIER_PROVIDER"] = "groq"
os.environ["GROQ_API_KEY"] = "test-key"

from moderation_pipeline import HARM_CATEGORIES, ModerationInput, moderate, route, run_evaluation


def model_result(primary_category, confidence, offending_segment="", explanation="Model supplied classification."):
    categories = {category: 0.0 for category in HARM_CATEGORIES}
    if primary_category != "none":
        categories[primary_category] = confidence
    return {
        "categories": categories,
        "primary_category": primary_category,
        "severity": "high" if confidence >= 0.8 else "medium" if confidence >= 0.55 else "none",
        "offending_segment": offending_segment,
        "explanation": explanation,
        "context_analysis": "The model considered content, platform policy, conversation context, and user history.",
        "recommended_action": "human_review" if confidence >= 0.55 else "allow",
    }


def fake_groq_classify(inp, policy):
    content = inp.content.lower()
    context = inp.conversation_context.lower()
    if "buy followers" in content:
        return model_result("spam", 0.91, "Buy followers", "Spam promotion detected.")
    if "i will kill you" in content and "movie quote" in context:
        return model_result("none", 0.0, "", "Quoted fictional dialogue is not a direct threat.")
    if "i will kill you" in content:
        return model_result("harassment", 0.92, "I will kill you", "Direct threat or intimidation.")
    if "explicit nudes" in content:
        return model_result("adult_content", 0.92, "explicit nudes", "Sexual content detected.")
    if "vaccines cause autism" in content:
        return model_result("misinformation", 0.90, "Vaccines cause autism", "Harmful medical misinformation detected.")
    if "fuck off" in content:
        return model_result("harassment", 0.86, "fuck off", "Directed profanity is harassment.")
    return model_result("none", 0.0, "", "No harm category applies.")

class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.classifier_patch = patch("moderation_pipeline.groq_classify", side_effect=fake_groq_classify)
        self.classifier_patch.start()

    def tearDown(self):
        self.classifier_patch.stop()

    def test_harm_categories_and_routing(self):
        res = moderate(ModerationInput(content="Buy followers now! Click this link!", platform="social_media"))
        self.assertEqual(res["primary_category"], "spam")
        self.assertIn(res["routing"], {"auto_action", "human_review"})
        self.assertEqual(res["classifier_provider"], "groq_llm")

    def test_context_changes_same_sentence(self):
        threat = moderate(ModerationInput(content="I will kill you.", platform="social_media", conversation_context="Direct argument between users."))
        quote = moderate(ModerationInput(content="The villain in the movie said, 'I will kill you.'", platform="social_media", conversation_context="Movie quote discussion."))
        self.assertGreater(threat["confidence"], quote["confidence"])
        self.assertEqual(quote["routing"], "allow")

    def test_explainability_segment_exists(self):
        res = moderate(ModerationInput(content="fuck off man", platform="social_media"))
        self.assertEqual(res["primary_category"], "harassment")
        self.assertTrue(res["offending_segment"])
        self.assertTrue(res["reasoning"])

    def test_evaluation_passes(self):
        report = run_evaluation()
        self.assertEqual(report["failed"], 0)

    def test_disabled_policy_category_allows(self):
        policy = {
            "review_threshold": 0.10,
            "auto_action_threshold": 0.10,
            "category_toggles": {"spam": False},
            "thresholds": {"spam": 0.10},
        }
        self.assertEqual(route("spam", 0.99, policy), ("allow", "allow", False))

if __name__ == "__main__":
    unittest.main()
