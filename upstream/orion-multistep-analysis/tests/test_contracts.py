from research_agent.agents.contracts import AnalysisResult, LiteratureSummary, SupervisorVerdict


def test_contract_dataclasses_import():
    assert AnalysisResult() is not None
    assert LiteratureSummary() is not None
    assert SupervisorVerdict(aligned=True) is not None
