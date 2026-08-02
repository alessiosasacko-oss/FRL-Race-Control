"use client";

import { useActionState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  dispatchAppDataChanged,
  scopesForPathname,
  type AppDataScope,
} from "@/lib/live/data-events";

type SuccessfulState = { status?: string };

export function useLiveActionState<State, Payload>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: Awaited<State>,
  permalink?: string,
  scopes?: readonly AppDataScope[],
): [Awaited<State>, (payload: Payload) => void, boolean] {
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState(action, initialState, permalink);
  const previousState = useRef(state);

  useEffect(() => {
    if (previousState.current !== state && (state as SuccessfulState).status === "success") {
      dispatchAppDataChanged(scopes ?? scopesForPathname(pathname));
    }
    previousState.current = state;
  }, [pathname, scopes, state]);

  return [state, formAction, pending];
}
