import {
  Avatar,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getFirebaseAuth } from "@/lib/firebase";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AccountSettingsPanel() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [hasPasswordProvider, setHasPasswordProvider] = useState(true);

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setStoreName(user.storeName || `${user.name || "My"}'s Sari-Sari`);
    setPhone(user.phone || "");
    setAvatarUrl(user.avatarUrl || "");

    try {
      const fbUser = getFirebaseAuth().currentUser;
      const providers = fbUser?.providerData?.map((p) => p.providerId) || [];
      setHasPasswordProvider(providers.includes("password"));
    } catch {
      setHasPasswordProvider(Boolean(user.email));
    }
  }, [user]);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_500_000) {
      toast({
        title: "Image too large",
        description: "Please use an image under 2.5MB",
        status: "error",
      });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setAvatarUrl(String(dataUrl));
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Username is required", status: "error" });
      return;
    }
    if (user.role === "seller" && !storeName.trim()) {
      toast({ title: "Store name is required", status: "error" });
      return;
    }

    setSaving(true);
    try {
      // Update Mongo first — avoid Firebase displayName churn wiping session mid-save
      const body = {
        name: name.trim(),
        phone: phone.trim() || null,
        avatarUrl: avatarUrl || null,
        markSetupComplete: true,
        setupComplete: true,
      };
      if (user.role === "seller") {
        body.storeName = storeName.trim();
      }

      const { user: updated } = await api.updateProfile(body);
      await refreshUser(updated);

      const fbUser = getFirebaseAuth().currentUser;
      if (fbUser) {
        await updateFirebaseProfile(fbUser, { displayName: name.trim() }).catch(() => {});
      }

      toast({ title: "Profile saved", status: "success" });
    } catch (err) {
      toast({ title: "Could not save profile", description: err.message, status: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", status: "error" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", status: "error" });
      return;
    }

    setPasswordSaving(true);
    try {
      const auth = getFirebaseAuth();
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error("Please sign in again");

      if (hasPasswordProvider) {
        await updatePassword(fbUser, password);
      } else {
        if (!fbUser.email && !user?.email) {
          throw new Error("Add an email to your account before setting a password");
        }
        const email = fbUser.email || user.email;
        const credential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(fbUser, credential);
        setHasPasswordProvider(true);
      }

      const { user: updated } = await api.updateProfile({
        markSetupComplete: true,
        setupComplete: true,
      });
      await refreshUser(updated);
      setPassword("");
      setConfirmPassword("");
      toast({
        title: hasPasswordProvider ? "Password updated" : "Password added",
        status: "success",
      });
    } catch (err) {
      const code = err?.code || "";
      let message = err.message || "Could not update password";
      if (code.includes("requires-recent-login")) {
        message = "For security, sign out and sign in again, then set your password.";
      }
      toast({ title: "Password error", description: message, status: "error" });
    } finally {
      setPasswordSaving(false);
    }
  }

  if (!user) return null;

  return (
    <VStack spacing={8} align="stretch" maxW="560px">
      <Box bg="white" p={6} rounded="lg" shadow="sm">
        <Heading size="md" mb={4}>
          Profile
        </Heading>
        <form onSubmit={handleSaveProfile}>
          <Stack spacing={4}>
            <HStack spacing={4} align="center">
              <Avatar size="xl" name={name || user.name} src={avatarUrl || undefined} />
              <FormControl>
                <FormLabel>Profile picture</FormLabel>
                <Input type="file" accept="image/*" onChange={handleAvatarChange} p={1} />
                <FormHelperText>JPG/PNG under 2.5MB</FormHelperText>
              </FormControl>
            </HStack>

            <FormControl isRequired>
              <FormLabel>Username</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <FormHelperText>Your personal display name (does not change your inventory).</FormHelperText>
            </FormControl>

            {user.role === "seller" && (
              <FormControl isRequired>
                <FormLabel>Sari-sari store name</FormLabel>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Aling Nena's Store"
                />
                <FormHelperText>Shown to buyers when they browse and pick up orders.</FormHelperText>
              </FormControl>
            )}

            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input value={user.email || ""} isReadOnly bg="gray.50" />
            </FormControl>

            <FormControl>
              <FormLabel>Phone</FormLabel>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+639171234567"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Role</FormLabel>
              <Input value={user.role} isReadOnly bg="gray.50" textTransform="capitalize" />
              <FormHelperText>Switch roles from the login/signup page with the same email.</FormHelperText>
            </FormControl>

            <Button type="submit" colorScheme="teal" isLoading={saving}>
              Save profile & finish setup
            </Button>
          </Stack>
        </form>
      </Box>

      <Box bg="white" p={6} rounded="lg" shadow="sm">
        <Heading size="md" mb={2}>
          {hasPasswordProvider ? "Change password" : "Add password"}
        </Heading>
        <Text fontSize="sm" color="gray.600" mb={4}>
          {hasPasswordProvider
            ? "Update the password you use for email sign-in."
            : "Your account was created with Google/phone. Add a password so you can also sign in with email."}
        </Text>
        <form onSubmit={handleSavePassword}>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>New password</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Confirm password</FormLabel>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </FormControl>
            <Button type="submit" colorScheme="teal" variant="outline" isLoading={passwordSaving}>
              {hasPasswordProvider ? "Update password" : "Add password"}
            </Button>
          </Stack>
        </form>
      </Box>
    </VStack>
  );
}
