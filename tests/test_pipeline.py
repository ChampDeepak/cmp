import os
import unittest

os.environ["CLASSIFIER_PROVIDER"] = "local"

from moderation_pipeline import ModerationInput, moderate, run_evaluation

class PipelineTest(unittest.TestCase):
    def test_harm_categories_and_routing(self):
        res = moderate(ModerationInput(content="Buy followers now! Click this link!", platform="social_media"))
        self.assertEqual(res["primary_category"], "spam")
        self.assertIn(res["routing"], {"auto_action", "human_review"})

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

if __name__ == "__main__":
    unittest.main()
