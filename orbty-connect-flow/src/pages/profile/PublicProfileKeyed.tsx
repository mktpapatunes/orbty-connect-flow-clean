import { useParams } from "react-router-dom";
import PublicProfile from "@/pages/PublicProfile";

export default function PublicProfileKeyed() {
  const { id } = useParams();
  return <PublicProfile key={id} />;
}