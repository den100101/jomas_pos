import { Navigate } from "react-router-dom";
import { getUser, getToken, canAccess, homePathFor } from "../utils/auth";

export default function RequireRole({ page, children }) {
  const user = getUser();

  if (!user || !getToken()) {
    return <Navigate to="/login" replace />;
  }
  if (!canAccess(user.role, page)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return children;
}
