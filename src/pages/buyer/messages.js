import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import MessagesPanel from "@/components/MessagesPanel";

export default function BuyerMessagesPage() {
  return (
    <ProtectedRoute role="buyer">
      <Layout title="Messages">
        <MessagesPanel />
      </Layout>
    </ProtectedRoute>
  );
}
