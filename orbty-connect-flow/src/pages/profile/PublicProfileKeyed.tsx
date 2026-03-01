import { useParams } from "react-router-dom";
import PublicProfile from "./PublicProfile";

export default function PublicProfileKeyed() {
  const { id } = useParams<{ id: string }>();
  // Remonta o componente sempre que o :id mudar (zera estado anterior 100%)
  return <PublicProfile key={id || "no-id"} />;
}