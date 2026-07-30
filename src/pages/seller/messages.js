import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import MessagesPanel from "@/components/MessagesPanel";

export default function SellerMessagesPage() {
  return (
    <ProtectedRoute role="seller">
      <Layout title="Messages">
        <MessagesPanel />
      </Layout>
    </ProtectedRoute>
  );
}
