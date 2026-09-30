"use client";

import { useTransition } from "react";
import { deleteCalculation, deleteClient, setClientStage } from "@/app/actions";
import { STAGES, inputClass } from "@/components/ui";

export function StageSelect({ clientId, stage }: { clientId: number; stage: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Stage"
      defaultValue={stage}
      disabled={pending}
      onChange={(e) => start(() => setClientStage(clientId, e.target.value))}
      className={`${inputClass} w-auto py-1.5 text-sm`}
    >
      {STAGES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function DeleteClientButton({ clientId, name }: { clientId: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => confirm(`Delete ${name} and unlink their saved breakdowns?`) && start(() => deleteClient(clientId))}
      className="text-sm text-red-600 hover:underline"
    >
      Delete client
    </button>
  );
}

export function DeleteCalcButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => confirm("Delete this saved breakdown? Shared links will stop working.") && start(() => deleteCalculation(id))} className="text-xs text-slate-400 hover:text-red-600">
      Delete
    </button>
  );
}
