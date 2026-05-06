import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    const syncSession = async (sess: Session | null) => {
      if (!active) return;
      console.log("[Auth] syncSession", {
        hasSession: !!sess,
        userId: sess?.user?.id,
        hasAccessToken: !!sess?.access_token,
      });
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Hardcode admin access for certain emails
        const isHardcodedAdmin = sess.user.email === "getdourak@gmail.com" || sess.user.email === "meetozaai@gmail.com";
        
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", sess.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!active) return;
        setIsAdmin(isHardcodedAdmin || !!data);
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    };

    // Set up listener BEFORE fetching session
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      console.log("[Auth] onAuthStateChange:", event, { hasSession: !!sess });
      setTimeout(() => void syncSession(sess), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] getSession initial:", { hasSession: !!session });
      void syncSession(session);
    }).catch((err) => {
      console.error("[Auth] getSession error:", err);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, loading, isAdmin, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
