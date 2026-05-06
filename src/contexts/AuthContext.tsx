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
        const isHardcodedAdmin = ["getdourak@gmail.com", "meetozaai@gmail.com"].includes(sess.user.email || "");
        
        try {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", sess.user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (active) {
            setIsAdmin(isHardcodedAdmin || !!data);
          }
        } catch (err) {
          console.error("[Auth] Error fetching roles:", err);
          if (active) setIsAdmin(isHardcodedAdmin);
        }
      } else {
        setIsAdmin(false);
      }

      // If we don't have a session but there's a hash, don't stop loading yet
      // as Supabase might be about to emit a SIGNED_IN event
      if (!sess && window.location.hash && window.location.hash.includes("access_token")) {
        console.log("[Auth] No session but hash exists, keeping loading=true");
        return;
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
