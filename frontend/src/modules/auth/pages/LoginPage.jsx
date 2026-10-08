import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { Field, Input, PrimaryButton, Alert } from "../../../components/ui";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "admin@tvione.local", password: "ChangeMe123!" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post(ENDPOINTS.AUTH.LOGIN, form);
      login(data.data.user, data.data.token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-50 text-slate-900 font-sans">
      <div className="w-full max-w-sm border border-slate-200 rounded-xl bg-white shadow-xl p-2.5">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 shadow-lg shadow-blue-600/30 flex items-center justify-center font-black text-slate-900 text-sm">TV</div>
          <div>
            <strong className="block text-sm text-slate-900">TVI One</strong>
            <small className="text-xs text-slate-500">Manufacturing ERP</small>
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-400 mt-1 mb-6">Sign in to your department workspace.</p>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <PrimaryButton disabled={loading} className="w-full py-2.5 text-sm">
            {loading ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </form>
        <p className="text-xs text-slate-600 mt-5 text-center">Demo admin: admin@tvione.local / ChangeMe123!</p>
      </div>
    </div>
  );
}
