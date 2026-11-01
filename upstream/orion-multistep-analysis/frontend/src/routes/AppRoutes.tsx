import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "@/components/Layout";
import DatasetsPage from "@/pages/DatasetsPage";
import PromptsPage from "@/pages/PromptsPage";
import RunDetailPage from "@/pages/RunDetailPage";
import RunsPage from "@/pages/RunsPage";

const AppRoutes = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/runs" replace />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="*" element={<Navigate to="/runs" replace />} />
      </Routes>
    </Layout>
  );
};

export default AppRoutes;
