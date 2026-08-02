import { memo } from "react";
import type { DriverCharacterConfiguration, NormalPose, TeamSuitConfiguration, WinnerPose } from "@/lib/characters/schema";

const skinColors = { TONE_1: "#F9DCC4", TONE_2: "#F1C6A8", TONE_3: "#DFA982", TONE_4: "#C98B63", TONE_5: "#A96F4F", TONE_6: "#835238", TONE_7: "#613A28", TONE_8: "#40271D" } as const;
const hairColors = { BLACK: "#111318", DARK_BROWN: "#2C1D18", BROWN: "#5A3825", LIGHT_BROWN: "#8A5D3B", BLOND: "#D7B56D", RED: "#8B3525", GRAY: "#858B94", WHITE: "#E7E9ED" } as const;
const eyeColors = { BROWN: "#6B402C", DARK_BROWN: "#2C1B17", BLUE: "#3E78A8", GREEN: "#4E7B57", GRAY: "#75808C", HAZEL: "#7C6A38" } as const;

type CharacterPose = NormalPose | WinnerPose;

export type DriverCharacterProps = {
  configuration: DriverCharacterConfiguration;
  teamSuit: TeamSuitConfiguration;
  pose?: CharacterPose;
  variant?: "fullBody" | "portrait" | "tableThumbnail" | "winner" | "dashboardHero";
  driverNumber?: number | null;
  driverInitials?: string;
  alt: string;
  className?: string;
  showShadow?: boolean;
  showBackground?: boolean;
};

function DriverCharacterComponent({
  configuration,
  teamSuit,
  pose = "NEUTRAL",
  variant = "fullBody",
  driverNumber,
  driverInitials,
  alt,
  className = "",
  showShadow = true,
  showBackground = false,
}: DriverCharacterProps) {
  const portrait = variant === "portrait" || variant === "tableThumbnail";
  const skin = skinColors[configuration.skinTone];
  const hair = hairColors[configuration.hairColor];
  const eyes = eyeColors[configuration.eyeColor];
  const strong = configuration.bodyShape === "STRONG" ? 12 : configuration.bodyShape === "SLIM" ? -8 : configuration.bodyShape === "ATHLETIC" ? 5 : 0;
  const armsUp = ["BOTH_ARMS_UP", "TROPHY", "CHAMPAGNE", "HELM_UP"].includes(pose);
  const fistUp = pose === "FIST_UP" || pose === "POINT_NUMBER_ONE";
  const crossed = pose === "ARMS_CROSSED";
  const helmetWorn = configuration.helmet.mode === "WORN_OPEN" || configuration.helmet.mode === "WORN_CLOSED";
  const viewBox = portrait ? "58 12 124 118" : "0 0 240 360";

  return (
    <svg role="img" aria-label={alt} viewBox={viewBox} className={`select-none overflow-visible ${className}`} xmlns="http://www.w3.org/2000/svg">
      {showBackground ? <g aria-hidden="true"><circle cx="120" cy="175" r="112" fill={teamSuit.primaryColor} opacity="0.14" /><path d="M10 300 230 60M45 350 238 157" stroke={teamSuit.accentColor} strokeWidth="2" opacity="0.18" /></g> : null}
      {showShadow && !portrait ? <ellipse cx="120" cy="344" rx="69" ry="11" fill="#020617" opacity="0.55" /> : null}

      <g aria-hidden="true" data-layer="body">
        <path d={`M${73 - strong / 2} 148 Q120 124 ${167 + strong / 2} 148 L181 272 Q158 294 120 294 Q82 294 59 272Z`} fill={teamSuit.primaryColor} stroke="#F8FAFC" strokeOpacity="0.12" strokeWidth="2" />
        <path d="M77 151 Q120 171 163 151 L153 178 Q120 194 87 178Z" fill={teamSuit.secondaryColor} />
        <path d="M111 143h18l9 34-18 19-18-19z" fill={teamSuit.accentColor} opacity="0.88" />
        {teamSuit.pattern === "DIAGONAL" ? <path d="m68 198 103-38 5 24-106 41z" fill={teamSuit.secondaryColor} opacity="0.85" /> : null}
        {teamSuit.pattern === "CENTER_STRIPE" ? <path d="M110 185h20v105h-20z" fill={teamSuit.secondaryColor} opacity="0.8" /> : null}
        {teamSuit.sideStripes ? <><path d="m65 187 14-5 10 103-13-8z" fill={teamSuit.accentColor} /><path d="m175 187-14-5-10 103 13-8z" fill={teamSuit.accentColor} /></> : null}
        <path d="M83 278 72 340h39l9-55 9 55h39l-11-62" fill={teamSuit.secondaryColor} stroke="#F8FAFC" strokeOpacity="0.1" strokeWidth="2" />
        <path d="M70 337h43v11H61q0-11 9-11ZM127 337h43q9 0 9 11h-52Z" fill={configuration.shoes === "WHITE" ? "#E2E8F0" : configuration.shoes === "TEAM" ? teamSuit.accentColor : "#111827"} />
      </g>

      <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round">
        {armsUp ? <><path d="M76 164 42 112 33 55" stroke={teamSuit.primaryColor} strokeWidth={25 + strong / 3} /><path d="M164 164 198 112 207 55" stroke={teamSuit.primaryColor} strokeWidth={25 + strong / 3} /><circle cx="32" cy="47" r="12" fill={configuration.gloves === "WHITE" ? "#E2E8F0" : teamSuit.accentColor} /><circle cx="208" cy="47" r="12" fill={configuration.gloves === "WHITE" ? "#E2E8F0" : teamSuit.accentColor} /></> : fistUp ? <><path d="M76 164 53 213" stroke={teamSuit.primaryColor} strokeWidth={26} /><path d="M164 164 192 105 197 53" stroke={teamSuit.primaryColor} strokeWidth={26} /><circle cx="198" cy="44" r="13" fill={teamSuit.accentColor} /></> : crossed ? <><path d="M73 172q44 48 94 4" stroke={teamSuit.primaryColor} strokeWidth="25" /><path d="M166 171q-43 48-92 5" stroke={teamSuit.secondaryColor} strokeWidth="22" /></> : <><path d="M73 164 55 258" stroke={teamSuit.primaryColor} strokeWidth={26} /><path d="M167 164 185 258" stroke={teamSuit.primaryColor} strokeWidth={26} /><circle cx="53" cy="265" r="11" fill={teamSuit.accentColor} /><circle cx="187" cy="265" r="11" fill={teamSuit.accentColor} /></>}
      </g>

      <g aria-hidden="true" data-layer="face">
        <path d={configuration.faceShape === "ANGULAR" ? "M82 58Q120 26 158 58l-5 62-33 24-33-24Z" : configuration.faceShape === "ROUND" ? "M82 60Q120 24 158 60v43q0 40-38 43-38-3-38-43Z" : "M84 54Q120 28 156 54l-3 58q-9 32-33 34-24-2-33-34Z"} fill={skin} stroke="#2A1D18" strokeOpacity="0.18" strokeWidth="2" />
        {!helmetWorn ? <path d={configuration.hairStyle === "BALD" ? "M91 56q29-25 58 0" : configuration.hairStyle === "UNDERCUT" ? "M82 65q7-38 40-40 30 2 38 37l-18-16-53 22Z" : configuration.hairStyle === "CURLY" ? "M82 66q0-36 38-43 40 5 40 43-12-18-23-9-10-20-20-3-15-13-35 12Z" : "M82 64q5-36 38-41 35 4 39 41-21-17-39-15-38-12-39 17-39 12Z"} fill={hair} /> : null}
        <path d="M95 84q10-7 19 0M127 84q10-7 19 0" stroke={hair} strokeWidth={configuration.eyebrowStyle === "BOLD" ? 5 : 3} strokeLinecap="round" />
        <ellipse cx="105" cy="94" rx={configuration.eyeShape === "NARROW" ? 7 : 6} ry={configuration.eyeShape === "NARROW" ? 2.5 : 4} fill="#F8FAFC" /><ellipse cx="136" cy="94" rx={configuration.eyeShape === "NARROW" ? 7 : 6} ry={configuration.eyeShape === "NARROW" ? 2.5 : 4} fill="#F8FAFC" /><circle cx="105" cy="94" r="2.7" fill={eyes} /><circle cx="136" cy="94" r="2.7" fill={eyes} />
        <path d={configuration.noseStyle === "WIDE" ? "m116 98-5 17 17 1" : "m119 98-3 17 10 1"} fill="none" stroke="#7C4A36" strokeOpacity="0.55" strokeWidth="2" />
        <path d={configuration.mouthStyle === "SMILE" ? "M106 126q14 12 29 0" : configuration.mouthStyle === "FOCUSED" ? "M108 127h25" : "M108 126q12 4 25 0"} fill="none" stroke="#7F3C3C" strokeWidth="2.5" strokeLinecap="round" />
        {configuration.beardStyle !== "NONE" ? <path d={configuration.beardStyle === "FULL" ? "M91 112q5 34 29 38 25-4 30-38-12 19-30 20-17-1-29-20Z" : "M98 125q22 15 44 0-8 19-22 20-14-1-22-20Z"} fill={hair} opacity={configuration.beardStyle === "LIGHT" ? 0.35 : 0.82} /> : null}
        {configuration.faceDetail === "FRECKLES" ? <g fill="#8B5A43" opacity="0.55"><circle cx="98" cy="108" r="1"/><circle cx="103" cy="110" r="1"/><circle cx="139" cy="109" r="1"/></g> : null}
        {configuration.eyewearStyle !== "NONE" ? <g fill={configuration.eyewearStyle === "SUNGLASSES" ? "#111827" : "none"} stroke="#CBD5E1" strokeWidth="2"><rect x="91" y="86" width="26" height="17" rx="7"/><rect x="124" y="86" width="26" height="17" rx="7"/><path d="M117 92h7"/></g> : null}
      </g>

      {helmetWorn ? <g aria-hidden="true" data-layer="helmet"><path d="M76 78q4-59 44-63 42 4 45 63l-11 31-68-2Z" fill={configuration.helmet.primaryColor} stroke={configuration.helmet.accentColor} strokeWidth="4"/><path d="M84 72q36-29 73 0l-7 23H91Z" fill={configuration.helmet.mode === "WORN_CLOSED" ? "#111827" : "#94A3B8"} opacity="0.9"/><path d="M93 38h55" stroke={configuration.helmet.secondaryColor} strokeWidth="8"/></g> : null}
      {!portrait && driverNumber != null ? <text x="120" y="232" textAnchor="middle" fill="#FFFFFF" fontSize="28" fontWeight="900" fontFamily="ui-monospace, monospace">{driverNumber}</text> : null}
      {!portrait && configuration.helmet.showInitials && driverInitials ? <text x="120" y="257" textAnchor="middle" fill={teamSuit.accentColor} fontSize="10" fontWeight="800">{driverInitials.slice(0, 3).toUpperCase()}</text> : null}
    </svg>
  );
}

const DriverCharacter = memo(DriverCharacterComponent);
export default DriverCharacter;
