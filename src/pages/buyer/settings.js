import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccountSettingsPanel from "@/components/AccountSettingsPanel";

export default function BuyerSettingsPage() {
  return (
    <ProtectedRoute role="buyer">
      <Layout title="Account Settings">
        <AccountSettingsPanel />
      </Layout>
    </ProtectedRoute>
  );
}
