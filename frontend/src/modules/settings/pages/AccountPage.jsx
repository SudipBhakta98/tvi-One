import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import {
  PageHeader,
  Panel,
  Field,
  Input,
  PrimaryButton,
  Alert,
  KpiCard,
} from "../../../components/ui";
import { useAuth } from "../../auth/contexts/AuthContext";

export default function AccountPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.confirmPassword)
      return setError("New password and confirmation do not match");
    if (form.newPassword.length < 8)
      return setError("New password must contain at least 8 characters");
    try {
      await api.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e) {
      setError(e.response?.data?.message || "Unable to change password");
    }
  };
  return (
    <div className="space-y-3 max-w-4xl">
      <PageHeader
        eyebrow="My Account"
        title="Account & Security"
        subtitle="Manage your profile security without administrator assistance."
      />
      {error && <Alert>{error}</Alert>}
      <div className="grid md:grid-cols-2 gap-3">
        <Panel title="Account">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Name" value={user?.name || "—"} />
            <KpiCard label="Role" value={user?.role || "—"} />
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 p-3 text-xs text-slate-400">
            {user?.email}
            <br />
            Department:{" "}
            <span className="text-slate-700">
              {user?.department || "GENERAL"}
            </span>
          </div>
        </Panel>
        <Panel title="Change password">
          <form onSubmit={submit} className="space-y-2">
            <Field label="Current password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(e) =>
                  setForm({ ...form, currentPassword: e.target.value })
                }
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) =>
                  setForm({ ...form, newPassword: e.target.value })
                }
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
              />
            </Field>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck size={14} />
                Other active sessions are revoked.
              </div>
              <PrimaryButton type="submit">
                <LockKeyhole size={14} />
                Change password
              </PrimaryButton>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
