import { Link } from "react-router-dom";

export const Logo = ({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) => {
  const sizes = { sm: "text-2xl", md: "text-3xl", lg: "text-5xl" };
  return (
    <Link to="/" className={`font-display font-black ${sizes[size]} ${className}`}>
      <span className="text-gradient">دَوْرَك</span>
    </Link>
  );
};
