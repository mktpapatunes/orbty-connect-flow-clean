import { useParams } from "react-router-dom";
import PublicProfile from "@/pages/profile/PublicProfile";

export default function PublicProfileKeyed() {
  const { id } = useParams<{ id: string }>();

  // key força remount quando muda o :id
  return <PublicProfile key={id || "public-profile"} />;
}