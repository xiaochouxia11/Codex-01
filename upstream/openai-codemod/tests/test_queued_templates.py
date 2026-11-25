from pathlib import Path
import unittest


SKILLS = Path(__file__).resolve().parents[1] / "skills"


class QueuedTemplateTests(unittest.TestCase):
    def test_queued_work_has_one_pending_result(self):
        templates = sorted(SKILLS.glob("*/assets/*-issue.md"))
        templates.extend([
            SKILLS / "assess/assets/investigation.md",
            SKILLS / "preflight/assets/preflight.md",
            SKILLS / "preflight/assets/preflight-check.md",
        ])
        for template in templates:
            with self.subTest(template=template.name):
                heading = "Result"
                pending = "**Outcome:** not_run"
                if template.name == "extraction-package-issue.md":
                    heading = "Checkpoint"
                if template.name == "final-coverage-issue.md":
                    pending = "**Mapping:** Not prepared."
                _, marker, result = template.read_text().partition(f"\n## {heading}\n")
                self.assertTrue(marker, f"Missing {heading} section")
                self.assertEqual(pending, result.strip())
