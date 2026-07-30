import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccountSettingsPanel from "@/components/AccountSettingsPanel";

export default function SellerSettingsPage() {
  return (
    <ProtectedRoute role="seller">
      <Layout title="Account Settings">
        <AccountSettingsPanel />
      </Layout>
    </ProtectedRoute>
  );
}
