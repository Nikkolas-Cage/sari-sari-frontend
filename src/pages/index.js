import { Center, Spinner } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else {
      router.replace(user.role === "seller" ? "/seller" : "/buyer");
    }
  }, [user, loading, router]);

  return (
    <Center minH="100vh">
      <Spinner size="xl" color="teal.500" />
    </Center>
  );
}
