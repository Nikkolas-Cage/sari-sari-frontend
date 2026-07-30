import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { api, clearSession, getStoredUser, saveUser, setTokenGetter } from "./api";
import { assertFirebaseConfig, getFirebaseAuth } from "./firebase";
import { connectRealtime, disconnectRealtime } from "./realtime";

const AuthContext = createContext(null);

function mapFirebaseError(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "This email is already registered";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "Incorrect email or password";
  }
  if (code.includes("user-not-found")) return "No account found with this email";
  if (code.includes("weak-password")) return "Password must be at least 6 characters";
  if (code.includes("invalid-email")) return "Please enter a valid email address";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
    return "Sign-in cancelled";
  }
  if (code.includes("operation-not-allowed")) {
    return "This sign-in option is temporarily unavailable";
  }
  if (code.includes("invalid-phone-number")) {
    return "Invalid phone number. Use format +639171234567";
  }
  if (code.includes("too-many-requests")) return "Too many attempts. Please try again later";
  if (code.includes("code-expired")) return "Code expired. Please request a new one";
  if (code.includes("invalid-verification-code")) return "Invalid verification code";
  if (code.includes("captcha-check-failed")) return "Verification failed. Please refresh and try again";
  return "Something went wrong. Please try again";
}

function isAccountExistsError(error) {
  return (
    error?.code === "ACCOUNT_EXISTS" ||
    error?.payload?.code === "ACCOUNT_EXISTS" ||
    error?.status === 409 ||
    String(error?.message || "").toLowerCase().includes("already exists")
  );
}

function isNeedsProfileError(error) {
  return (
    error?.code === "NEEDS_PROFILE" ||
    error?.payload?.code === "NEEDS_PROFILE" ||
    (error?.status === 404 &&
      String(error?.message || "")
        .toLowerCase()
        .includes("seller or buyer"))
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingProfile, setPendingProfile] = useState(null);
  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);
  // Blocks onAuthStateChanged from racing intentional login/signup
  const authInFlightRef = useRef(0);
  const authEpochRef = useRef(0);
  const router = useRouter();

  function beginAuth() {
    authInFlightRef.current += 1;
    authEpochRef.current += 1;
  }

  function endAuth() {
    authInFlightRef.current = Math.max(0, authInFlightRef.current - 1);
  }

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      assertFirebaseConfig();
      const auth = getFirebaseAuth();

      setTokenGetter(async () => {
        if (!auth.currentUser) return null;
        return auth.currentUser.getIdToken();
      });

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          if (authInFlightRef.current === 0) {
            clearSession();
            setUser(null);
            setPendingProfile(null);
          }
          setLoading(false);
          return;
        }

        if (authInFlightRef.current > 0) {
          setLoading(false);
          return;
        }

        // Don't auto-call /session for brand-new Firebase users — that causes
        // NEEDS_PROFILE toasts while the login button flow is handling role.
        const stored = getStoredUser();
        if (!stored) {
          setLoading(false);
          return;
        }

        const epoch = authEpochRef.current;

        try {
          // Prefer /me so Firebase displayName updates don't re-run session/role logic
          const { user: profile } = await api.me();
          if (epoch !== authEpochRef.current || authInFlightRef.current > 0) return;
          saveUser(profile);
          setUser(profile);
          setPendingProfile(null);
          connectRealtime(() => getFirebaseAuth().currentUser?.getIdToken());
        } catch (error) {
          if (epoch !== authEpochRef.current || authInFlightRef.current > 0) return;
          // Fallback session only if /me fails (e.g. first restore)
          try {
            const idToken = await firebaseUser.getIdToken();
            const { user: profile } = await api.session({ idToken, intent: "login" });
            if (epoch !== authEpochRef.current || authInFlightRef.current > 0) return;
            saveUser(profile);
            setUser(profile);
            connectRealtime(() => getFirebaseAuth().currentUser?.getIdToken());
          } catch {
            setUser(stored);
          }
        } finally {
          setLoading(false);
        }
      });
    } catch (error) {
      console.error(error.message);
      setLoading(false);
    }

    return () => {
      unsubscribe();
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  function finishLogin(profile) {
    saveUser(profile);
    setUser(profile);
    setPendingProfile(null);
    connectRealtime(() => getFirebaseAuth().currentUser?.getIdToken());
    router.push(profile.role === "seller" ? "/seller" : "/buyer");
  }

  async function refreshUser(profile = null) {
    if (profile) {
      saveUser(profile);
      setUser(profile);
      return profile;
    }
    const { user: me } = await api.me();
    saveUser(me);
    setUser(me);
    return me;
  }

  /**
   * Rules:
   * 1. Existing profile + role chosen → switch role if needed, then open that portal
   * 2. Existing profile + no role → login with current role
   * 3. No Mongo profile + role → create buyer/seller
   * 4. No Mongo profile + no role → ask for role
   */
  async function syncFirebaseUser(firebaseUser, { name = null, role = null, isSignup = false } = {}) {
    const idToken = await firebaseUser.getIdToken(true);
    const suggestedName =
      name ||
      firebaseUser.displayName ||
      firebaseUser.phoneNumber ||
      firebaseUser.email?.split("@")[0] ||
      "User";

    try {
      const { user: profile } = await api.session({
        idToken,
        name: suggestedName,
        role: role || undefined,
        intent: isSignup ? "signup" : "login",
      });
      finishLogin(profile);
      return { status: "logged_in", user: profile };
    } catch (error) {
      // Signup only: reject duplicates
      if (isAccountExistsError(error) && isSignup) {
        await signOut(getFirebaseAuth()).catch(() => {});
        clearSession();
        setUser(null);
        throw new Error("An account already exists for this sign-in. Please sign in instead.");
      }

      // Login path: if somehow marked exists, just sign in
      if (isAccountExistsError(error) && !isSignup) {
        const { user: profile } = await api.session({
          idToken,
          intent: "login",
        });
        finishLogin(profile);
        return { status: "logged_in", user: profile };
      }

      if (isNeedsProfileError(error)) {
        // Role already chosen on the page — create the profile
        if (role) {
          const { user: profile } = await api.session({
            idToken,
            name: suggestedName,
            role,
            intent: "login",
          });
          finishLogin(profile);
          return { status: "registered", user: profile };
        }

        setPendingProfile({
          idToken,
          suggestedName,
          email: firebaseUser.email || firebaseUser.phoneNumber || "",
        });
        return { status: "needs_profile" };
      }

      throw error;
    }
  }

  async function login(email, password, role = null) {
    beginAuth();
    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email, password).catch((error) => {
        throw new Error(mapFirebaseError(error));
      });
      return await syncFirebaseUser(credential.user, { role, isSignup: false });
    } finally {
      endAuth();
    }
  }

  async function register({ name, email, password, role }) {
    beginAuth();
    const auth = getFirebaseAuth();
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password).catch((error) => {
        throw new Error(mapFirebaseError(error));
      });

      if (name) {
        await updateProfile(credential.user, { displayName: name }).catch(() => {});
      }

      try {
        return await syncFirebaseUser(credential.user, { name, role, isSignup: true });
      } catch (error) {
        await credential.user.delete().catch(() => {});
        await signOut(auth).catch(() => {});
        throw error;
      }
    } finally {
      endAuth();
    }
  }

  async function resetPassword(email) {
    const auth = getFirebaseAuth();
    const trimmed = String(email || "").trim();
    if (!trimmed) throw new Error("Please enter your email address");

    await sendPasswordResetEmail(auth, trimmed).catch((error) => {
      throw new Error(mapFirebaseError(error));
    });
    return { status: "sent" };
  }

  function ensureRecaptcha(containerId = "recaptcha-container") {
    const auth = getFirebaseAuth();
    if (recaptchaRef.current) return recaptchaRef.current;

    recaptchaRef.current = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
    });
    return recaptchaRef.current;
  }

  async function loginWithGoogle(role = null, { isSignup = false } = {}) {
    beginAuth();
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const credential = await signInWithPopup(auth, provider);
      return await syncFirebaseUser(credential.user, {
        role: role || null,
        isSignup: Boolean(isSignup),
      });
    } catch (error) {
      if (
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "POPUP_CLOSED"
      ) {
        const err = new Error("Sign-in cancelled");
        err.code = "POPUP_CLOSED";
        throw err;
      }
      if (isNeedsProfileError(error)) {
        if (role && auth.currentUser) {
          const idToken = await auth.currentUser.getIdToken(true);
          const { user: profile } = await api.session({
            idToken,
            name: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
            role,
            intent: "login",
          });
          finishLogin(profile);
          return { status: "registered", user: profile };
        }
        setPendingProfile({
          idToken: (await auth.currentUser?.getIdToken(true)) || null,
          suggestedName:
            auth.currentUser?.displayName ||
            auth.currentUser?.email?.split("@")[0] ||
            "User",
          email: auth.currentUser?.email || auth.currentUser?.phoneNumber || "",
        });
        return { status: "needs_profile" };
      }
      if (isAccountExistsError(error) && isSignup) {
        await signOut(auth).catch(() => {});
        throw new Error("An account already exists for this sign-in. Please sign in instead.");
      }
      if (isAccountExistsError(error) && !isSignup && auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken(true);
        const { user: profile } = await api.session({ idToken, intent: "login" });
        finishLogin(profile);
        return { status: "logged_in", user: profile };
      }
      throw error instanceof Error && error.message && !String(error.code || "").startsWith("auth/")
        ? error
        : new Error(mapFirebaseError(error));
    } finally {
      endAuth();
    }
  }

  async function sendPhoneCode(phoneNumber) {
    const auth = getFirebaseAuth();
    const appVerifier = ensureRecaptcha();

    try {
      confirmationRef.current = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      return { status: "code_sent" };
    } catch (error) {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
      throw new Error(mapFirebaseError(error));
    }
  }

  async function verifyPhoneCode(code, role = null, { isSignup = false } = {}) {
    if (!confirmationRef.current) {
      throw new Error("Request a verification code first");
    }

    beginAuth();
    try {
      const result = await confirmationRef.current.confirm(code).catch((error) => {
        throw new Error(mapFirebaseError(error));
      });
      confirmationRef.current = null;
      return await syncFirebaseUser(result.user, { role, isSignup: Boolean(isSignup) });
    } finally {
      endAuth();
    }
  }

  async function completeSocialProfile({ name, role }) {
    if (!pendingProfile?.idToken && !getFirebaseAuth().currentUser) {
      throw new Error("Please sign in again to finish setting up your account");
    }

    beginAuth();
    try {
      const auth = getFirebaseAuth();
      const idToken = auth.currentUser
        ? await auth.currentUser.getIdToken(true)
        : pendingProfile.idToken;

      try {
        const { user: profile } = await api.session({
          idToken,
          name: name || pendingProfile?.suggestedName,
          role,
          intent: "login",
        });
        finishLogin(profile);
      } catch (error) {
        if (isAccountExistsError(error)) {
          const { user: profile } = await api.session({ idToken, intent: "login" });
          finishLogin(profile);
          return;
        }
        throw error;
      }
    } finally {
      endAuth();
    }
  }

  async function cancelPendingProfile() {
    setPendingProfile(null);
    try {
      await signOut(getFirebaseAuth());
    } catch {
      // ignore
    }
    clearSession();
    setUser(null);
  }

  async function logout() {
    try {
      disconnectRealtime();
      await signOut(getFirebaseAuth());
    } catch {
      // ignore
    }
    clearSession();
    setUser(null);
    setPendingProfile(null);
    confirmationRef.current = null;
    router.push("/login");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pendingProfile,
        login,
        register,
        resetPassword,
        loginWithGoogle,
        sendPhoneCode,
        verifyPhoneCode,
        completeSocialProfile,
        cancelPendingProfile,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
