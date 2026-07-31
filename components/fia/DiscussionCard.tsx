"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  File,
  FileImage,
  FileVideo,
  Gavel,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
  Scale,
  Send,
  Vote,
  X,
} from "lucide-react";
import {
  DecisionOutcome,
  DiscussionMessageType,
  PenaltyProposalStatus,
  PenaltyType,
  ProposalKind,
  TicketStatus,
  decisionOutcomeLabels,
  penaltyTypeLabels,
  roleLabels,
} from "@/domain";
import { addFiaDiscussionMessageAction } from "@/lib/fia/actions";
import { createPenaltyProposalAction } from "@/lib/fia/proposal-actions";
import {
  extractMentionQuery,
  isChatNearBottom,
} from "@/lib/fia/chat-policy";
import {
  initialFiaActionState,
  type FiaTicketDetail,
} from "@/lib/fia/types";
import { countryCodeToFlagEmoji } from "@/lib/countries";
import ActionMessage from "./ActionMessage";
import PenaltyProposalCard from "./PenaltyProposalCard";

type Proposal = NonNullable<
  FiaTicketDetail["discussionMessages"][number]["proposal"]
>;

type DiscussionCardProps = {
  ticketId: number;
  status: FiaTicketDetail["status"];
  messages: FiaTicketDetail["discussionMessages"];
  drivers: FiaTicketDetail["drivers"];
  evidence: FiaTicketDetail["evidence"];
  mentionCandidates: FiaTicketDetail["mentionCandidates"];
  currentUser: { id: number; displayName: string };
  canVote: boolean;
  canDecide: boolean;
};

const valuePenaltyTypes = new Set<PenaltyType>([
  PenaltyType.TimePenalty,
  PenaltyType.PenaltyPoints,
  PenaltyType.PointsDeduction,
]);

const proposalPenaltyTypes = Object.values(PenaltyType).filter(
  (penalty) =>
    penalty !== PenaltyType.NoFurtherAction &&
    penalty !== PenaltyType.GridPenalty,
);

type EvidenceAction =
  | "file"
  | "image"
  | "video"
  | "external";

function dispatchEvidenceAction(action: EvidenceAction): void {
  window.dispatchEvent(
    new CustomEvent("frl-evidence-action", {
      detail: { action },
    }),
  );
}

export default function DiscussionCard({
  ticketId,
  status,
  messages,
  drivers,
  evidence,
  mentionCandidates,
  currentUser,
  canVote,
  canDecide,
}: DiscussionCardProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const [menuOpen, setMenuOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalKind, setProposalKind] = useState<ProposalKind>(
    ProposalKind.Penalty,
  );
  const [revision, setRevision] = useState<Proposal | null>(
    null,
  );
  const [penaltyType, setPenaltyType] = useState<PenaltyType>(
    PenaltyType.TimePenalty,
  );
  const [messageText, setMessageText] = useState("");
  const [clientMessageId, setClientMessageId] = useState("");
  const [selectedMentionIds, setSelectedMentionIds] = useState<number[]>(
    [],
  );
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messageAction = addFiaDiscussionMessageAction.bind(
    null,
    ticketId,
  );
  const proposalAction = createPenaltyProposalAction.bind(
    null,
    ticketId,
  );
  const [messageState, messageFormAction, messagePending] =
    useActionState(messageAction, initialFiaActionState);
  const [proposalState, proposalFormAction, proposalPending] =
    useActionState(proposalAction, initialFiaActionState);
  const hasOpenProposal = messages.some(
    (message) =>
      message.proposal?.status === PenaltyProposalStatus.Open,
  );
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const normalized = mentionQuery.toLocaleLowerCase("de-DE");
    return mentionCandidates
      .filter(
        (candidate) =>
          candidate.id !== currentUser.id &&
          candidate.displayName
            .toLocaleLowerCase("de-DE")
            .includes(normalized),
      )
      .slice(0, 8);
  }, [currentUser.id, mentionCandidates, mentionQuery]);

  useEffect(() => {
    if (!hasOpenProposal) return;
    const interval = window.setInterval(() => {
      router.refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [hasOpenProposal, router]);

  useEffect(() => {
    if (messageState.status !== "success") return;
    const timeout = window.setTimeout(() => {
      setMessageText("");
      setSelectedMentionIds([]);
      setMentionQuery(null);
      setClientMessageId("");
      router.refresh();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [messageState, router]);

  useEffect(() => {
    const list = messageListRef.current;
    const added = Math.max(
      0,
      messages.length - previousMessageCountRef.current,
    );
    previousMessageCountRef.current = messages.length;
    if (!list || added === 0) return;
    list.scrollTo({
      top: isNearBottom ? list.scrollHeight : list.scrollTop,
      behavior: isNearBottom ? "smooth" : "auto",
    });
    const timeout = window.setTimeout(() => {
      if (isNearBottom) setNewMessageCount(0);
      else setNewMessageCount((count) => count + added);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isNearBottom, messages.length]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, []);

  function updateMessage(value: string): void {
    if (!clientMessageId) {
      setClientMessageId(crypto.randomUUID());
    }
    setMessageText(value);
    setMentionQuery(extractMentionQuery(value));
    setMentionIndex(0);
    setSelectedMentionIds((ids) =>
      ids.filter((id) => {
        const candidate = mentionCandidates.find(
          (item) => item.id === id,
        );
        return candidate
          ? value.includes(`@${candidate.displayName}`)
          : false;
      }),
    );
  }

  function selectMention(
    candidate: FiaTicketDetail["mentionCandidates"][number],
  ): void {
    const next = messageText.replace(
      /@[\p{L}\p{N}._-]*$/u,
      `@${candidate.displayName} `,
    );
    setMessageText(next);
    setSelectedMentionIds((ids) =>
      ids.includes(candidate.id) ? ids : [...ids, candidate.id],
    );
    setMentionQuery(null);
    setMentionIndex(0);
  }

  function handleMessageKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void {
    if (mentionMatches.length > 0 && mentionQuery !== null) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setMentionIndex(
          (index) =>
            (index + direction + mentionMatches.length) %
            mentionMatches.length,
        );
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        selectMention(mentionMatches[mentionIndex] ?? mentionMatches[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleMessageScroll(): void {
    const list = messageListRef.current;
    if (!list) return;
    const nearBottom = isChatNearBottom(
      list.scrollHeight,
      list.scrollTop,
      list.clientHeight,
    );
    setIsNearBottom(nearBottom);
    if (nearBottom) setNewMessageCount(0);
  }

  function scrollToLatest(): void {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    setIsNearBottom(true);
    setNewMessageCount(0);
  }

  function openEvidence(action: EvidenceAction): void {
    setMenuOpen(false);
    dispatchEvidenceAction(action);
  }

  function openProposal(
    source: "proposal" | "vote",
  ): void {
    setRevision(null);
    setProposalKind(
      source === "vote"
        ? ProposalKind.General
        : ProposalKind.Penalty,
    );
    setPenaltyType(PenaltyType.TimePenalty);
    setProposalOpen(true);
    setMenuOpen(false);
    if (source === "vote") {
      window.setTimeout(() => {
        document
          .getElementById("proposal-closing")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }

  function reviseProposal(proposal: Proposal): void {
    setRevision(proposal);
    setProposalKind(proposal.kind);
    setPenaltyType(proposal.penaltyType);
    setProposalOpen(true);
    window.setTimeout(() => {
      document
        .getElementById("penalty-proposal-composer")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  return (
    <section className="surface-panel rounded-[1.25rem] border-[color-mix(in_srgb,var(--page-accent)_25%,transparent)] p-4 sm:p-6 xl:min-h-[52rem]">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
          <MessageSquare size={19} />
        </span>
        <h2 className="text-lg font-bold text-white sm:text-xl">
          Steward-Diskussion ({messages.length})
        </h2>
      </div>

      <div
        ref={messageListRef}
        onScroll={handleMessageScroll}
        className="mt-5 max-h-[38rem] space-y-3 overflow-y-auto pr-1 xl:max-h-[48rem]"
      >
        {messages.map((message) =>
          message.type ===
            DiscussionMessageType.PenaltyProposal &&
          message.proposal ? (
            <PenaltyProposalCard
              key={message.id}
              proposal={message.proposal}
              currentUser={currentUser}
              canVote={canVote}
              canDecide={canDecide}
              onRevise={reviseProposal}
            />
          ) : message.type === DiscussionMessageType.System ? (
            <article
              key={message.id}
              className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400"
            >
              <Gavel
                size={16}
                className="mt-0.5 shrink-0 text-blue-400"
              />
              <div className="min-w-0">
                <p>{message.message}</p>
                <time className="mt-1 block text-xs text-slate-600">
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(message.updatedAt))}
                </time>
              </div>
            </article>
          ) : (
            <article
              key={message.id}
              id={`message-${message.id}`}
              className="rounded-2xl rounded-tl-md border border-slate-700/80 bg-slate-900/80 p-4 sm:ml-10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">
                  {message.author.displayName}
                </p>
                <time className="text-xs text-slate-500">
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(message.createdAt))}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-slate-300">
                {renderChatMessage(message.message, message.mentions)}
              </p>
            </article>
          ),
        )}
        {messages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            Die Steward-Diskussion ist noch leer.
          </p>
        ) : null}
        {messagePending && messageText.trim() ? (
          <article className="rounded-2xl rounded-tl-md border border-blue-500/30 bg-blue-500/5 p-4 opacity-70 sm:ml-10">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">
                {currentUser.displayName}
              </p>
              <span className="text-xs text-blue-300">
                Wird gesendet…
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-slate-300">
              {messageText}
            </p>
          </article>
        ) : null}
      </div>

      {newMessageCount > 0 ? (
        <button
          type="button"
          onClick={scrollToLatest}
          className="mx-auto mt-3 flex min-h-10 items-center rounded-full border border-blue-500/40 bg-blue-500/15 px-4 text-sm font-semibold text-blue-100"
        >
          {newMessageCount} neue Nachricht
          {newMessageCount === 1 ? "" : "en"}
        </button>
      ) : null}

      {status !== TicketStatus.Resolved ? (
        <div className="mt-5 border-t border-slate-800 pt-5">
          {proposalOpen ? (
            <form
              key={`${revision?.id ?? "new-proposal"}-${proposalKind}`}
              id="penalty-proposal-composer"
              action={proposalFormAction}
              className="mb-4 space-y-4 rounded-2xl border border-blue-500/40 bg-slate-950/70 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Scale
                      size={19}
                      className="text-blue-300"
                    />
                    <h3 className="font-bold text-white">
                      {revision
                        ? `Neue Revision zu Vorschlag #${revision.id}`
                        : proposalKind === ProposalKind.General
                          ? "Abstimmung starten"
                          : "Strafenvorschlag erstellen"}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Der Vorschlag wird als strukturierte Nachricht in
                    dieser Unterhaltung gespeichert.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProposalOpen(false);
                    setRevision(null);
                  }}
                  aria-label="Vorschlag schließen"
                  className="min-h-11 min-w-11 rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <input
                type="hidden"
                name="supersedesId"
                value={revision?.id ?? ""}
              />
              <input type="hidden" name="kind" value={proposalKind} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-300">
                  <span>Titel</span>
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={160}
                    defaultValue={
                      revision?.title ??
                      (proposalKind === ProposalKind.Penalty
                        ? "Strafenvorschlag"
                        : "")
                    }
                    placeholder="Worum soll abgestimmt werden?"
                    className="form-control min-h-12"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-300">
                  <span>Mögliche Entscheidung</span>
                  <select
                    name="proposedOutcome"
                    required
                    defaultValue={
                      revision?.proposedOutcome ??
                      (proposalKind === ProposalKind.Penalty
                        ? DecisionOutcome.Penalty
                        : DecisionOutcome.NoFurtherInvestigation)
                    }
                    className="form-control min-h-12"
                  >
                    {Object.values(DecisionOutcome).map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {decisionOutcomeLabels[outcome]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-300">
                  <span>Betroffener Fahrer</span>
                  <select
                    name="affectedDriverId"
                    required
                    defaultValue={
                      revision?.affectedDriver.id ?? ""
                    }
                    className="form-control min-h-12"
                  >
                    <option value="" disabled>
                      Fahrer auswählen
                    </option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {countryCodeToFlagEmoji(driver.flag) ?? driver.flag} {driver.name} · #{driver.number}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-300">
                  <span>Vorgeschlagene Strafe</span>
                  <select
                    name="penaltyType"
                    required
                    value={penaltyType}
                    onChange={(event) =>
                      setPenaltyType(
                        event.target.value as PenaltyType,
                      )
                    }
                    className="form-control min-h-12"
                  >
                    {proposalPenaltyTypes.map((penalty) => (
                      <option key={penalty} value={penalty}>
                        {penaltyTypeLabels[penalty]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {valuePenaltyTypes.has(penaltyType) ? (
                <label className="block space-y-1 text-sm text-slate-300">
                  <span>
                    {penaltyType === PenaltyType.TimePenalty
                      ? "Strafwert in Sekunden"
                      : penaltyType === PenaltyType.PenaltyPoints
                        ? "Strafpunkte"
                        : "Punktabzug"}
                  </span>
                  <input
                    name="penaltyValue"
                    type="number"
                    min={0}
                    step={
                      penaltyType === PenaltyType.TimePenalty
                        ? "0.001"
                        : "1"
                    }
                    required
                    list={
                      penaltyType === PenaltyType.TimePenalty
                        ? "common-time-penalties"
                        : undefined
                    }
                    defaultValue={revision?.penaltyValue ?? ""}
                    placeholder="z. B. 5, 10, 15 oder 20"
                    className="form-control min-h-12"
                  />
                  <datalist id="common-time-penalties">
                    {[5, 10, 15, 20].map((seconds) => (
                      <option key={seconds} value={seconds} />
                    ))}
                  </datalist>
                </label>
              ) : null}

              <label className="block space-y-1 text-sm text-slate-300">
                <span>
                  {proposalKind === ProposalKind.General
                    ? "Beschreibung und Begründung"
                    : "Begründung"}
                </span>
                <textarea
                  name="reason"
                  rows={4}
                  required
                  minLength={5}
                  maxLength={5000}
                  defaultValue={revision?.reason ?? ""}
                  placeholder="Nachvollziehbare Begründung des Vorschlags…"
                  className="form-control"
                />
              </label>

              <div
                id="proposal-closing"
                className="grid gap-3 sm:grid-cols-2"
              >
                <label className="space-y-1 text-sm text-slate-300">
                  <span>Abstimmungsdauer</span>
                  <select
                    name="durationMinutes"
                    defaultValue="MANUAL"
                    className="form-control min-h-12"
                  >
                    <option value="MANUAL">
                      Manuell schließen
                    </option>
                    <option value="15">15 Minuten</option>
                    <option value="30">30 Minuten</option>
                    <option value="60">1 Stunde</option>
                    <option value="120">2 Stunden</option>
                    <option value="1440">24 Stunden</option>
                  </select>
                </label>
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-700 px-4 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    name="closeWhenAllVoted"
                    className="h-5 w-5 accent-blue-500"
                  />
                  Schließen, wenn alle Pflichtstimmen vorliegen
                </label>
              </div>

              {evidence.length > 0 ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm text-slate-300">
                    Beweise verknüpfen (optional)
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {evidence.map((item) => (
                      <label
                        key={item.id}
                        className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-700 px-3 text-sm text-slate-300"
                      >
                        <input
                          type="checkbox"
                          name="evidenceId"
                          value={item.id}
                          className="h-5 w-5 accent-blue-500"
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <ActionMessage state={proposalState} />
              <button
                type="submit"
                disabled={proposalPending || !canVote}
                className="wizard-primary-button min-h-12 w-full justify-center"
              >
                {proposalPending
                  ? "Erstellt…"
                  : revision
                    ? "Neue Revision erstellen"
                    : proposalKind === ProposalKind.General
                      ? "Abstimmung starten"
                      : "Vorschlag erstellen und Abstimmung starten"}
              </button>
            </form>
          ) : null}

          <form
            ref={formRef}
            action={messageFormAction}
            onSubmit={() => setMentionQuery(null)}
          >
            <input
              type="hidden"
              name="clientMessageId"
              value={clientMessageId}
            />
            {selectedMentionIds.map((userId) => (
              <input
                key={userId}
                type="hidden"
                name="mentionUserId"
                value={userId}
              />
            ))}
            <div className="relative flex items-end gap-2 rounded-2xl border border-slate-700 bg-slate-950/80 p-2 shadow-inner focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label="Aktionen öffnen"
                className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-blue-300 transition hover:bg-slate-700"
              >
                {menuOpen ? <X size={22} /> : <Plus size={24} />}
              </button>
              <textarea
                name="message"
                value={messageText}
                onChange={(event) => updateMessage(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                rows={1}
                required
                minLength={2}
                maxLength={5000}
                placeholder="Nachricht an die Stewards…"
                className="min-h-12 flex-1 resize-y bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              {mentionQuery !== null && mentionMatches.length > 0 ? (
                <div
                  role="listbox"
                  aria-label="Person erwähnen"
                  className="absolute bottom-16 left-14 right-2 z-30 max-h-72 overflow-y-auto rounded-2xl border border-slate-700 bg-[#151B24] p-2 shadow-2xl"
                >
                  {mentionMatches.map((candidate, index) => (
                    <button
                      key={candidate.id}
                      type="button"
                      role="option"
                      aria-selected={index === mentionIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectMention(candidate)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left ${
                        index === mentionIndex
                          ? "bg-blue-500/15"
                          : "hover:bg-slate-800"
                      }`}
                    >
                      {candidate.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={candidate.avatarUrl}
                          alt=""
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-9 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
                          {candidate.displayName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-white">
                          {candidate.displayName}
                        </strong>
                        <span className="block truncate text-xs text-slate-400">
                          {candidate.roles[0]
                            ? roleLabels[candidate.roles[0]]
                            : "Race Control"}
                          {candidate.league
                            ? ` · ${candidate.league.code}`
                            : ""}
                          {candidate.team
                            ? ` · ${candidate.team.name}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={
                  messagePending ||
                  !clientMessageId ||
                  messageText.trim().length < 2
                }
                aria-label="Nachricht senden"
                className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                <Send size={19} />
              </button>

              {menuOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Aktionsmenü schließen"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 bg-black/50 sm:absolute sm:inset-auto sm:bottom-16 sm:left-0 sm:h-0 sm:w-0 sm:bg-transparent"
                  />
                  <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-slate-700 bg-[#151B24] p-4 shadow-2xl sm:absolute sm:inset-auto sm:bottom-16 sm:left-0 sm:w-80 sm:rounded-2xl">
                    <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-600 sm:hidden" />
                    <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Aktion hinzufügen
                    </p>
                    <div className="grid gap-1">
                      <MenuButton
                        icon={<File size={18} />}
                        label="Datei anhängen"
                        onClick={() => openEvidence("file")}
                      />
                      <MenuButton
                        icon={<FileImage size={18} />}
                        label="Bild anhängen"
                        onClick={() => openEvidence("image")}
                      />
                      <MenuButton
                        icon={<FileVideo size={18} />}
                        label="Video anhängen"
                        onClick={() => openEvidence("video")}
                      />
                      <MenuButton
                        icon={<Link2 size={18} />}
                        label="Externen Beweislink hinzufügen"
                        onClick={() => openEvidence("external")}
                      />
                      <div className="my-1 border-t border-slate-800" />
                      <MenuButton
                        icon={<Scale size={18} />}
                        label="Strafenvorschlag erstellen"
                        important
                        disabled={!canVote}
                        onClick={() => openProposal("proposal")}
                      />
                      <MenuButton
                        icon={<Vote size={18} />}
                        label="Abstimmung starten"
                        disabled={!canVote}
                        onClick={() => openProposal("vote")}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <div className="mt-2 flex min-h-6 items-center justify-between gap-3">
              <ActionMessage state={messageState} />
              <span className="hidden items-center gap-1 text-xs text-slate-600 sm:flex">
                <Paperclip size={13} />
                Anhänge über +
              </span>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function renderChatMessage(
  message: string,
  mentions: FiaTicketDetail["discussionMessages"][number]["mentions"],
): React.ReactNode[] {
  const mentionByToken = new Map(
    mentions.map((mention) => [`@${mention.displayName}`, mention]),
  );
  const mentionPattern = [...mentionByToken.keys()]
    .sort((left, right) => right.length - left.length)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const tokenPattern = mentionPattern
    ? `(${mentionPattern}|https?:\\/\\/[^\\s]+)`
    : "(https?:\\/\\/[^\\s]+)";
  const parts = message.split(new RegExp(tokenPattern, "g"));

  return parts
    .filter((part) => part !== "")
    .map((part, index) => {
      const mention = mentionByToken.get(part);
      if (mention) {
        return (
          <span
            key={`${part}-${index}`}
            className="rounded bg-blue-500/20 px-1 font-semibold text-blue-200"
            title={`User-ID ${mention.id}`}
          >
            {part}
          </span>
        );
      }
      if (/^https?:\/\//i.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-200"
          >
            {part}
          </a>
        );
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
}

function MenuButton({
  icon,
  label,
  onClick,
  important = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  important?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        important
          ? "bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
          : "text-slate-200 hover:bg-slate-800"
      }`}
    >
      <span
        className={important ? "text-blue-300" : "text-slate-400"}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
