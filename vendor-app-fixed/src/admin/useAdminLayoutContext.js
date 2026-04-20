import { useOutletContext } from "react-router-dom";

export function useAdminLayoutContext() {
  return useOutletContext();
}
