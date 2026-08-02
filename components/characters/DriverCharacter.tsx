import { memo, useId } from "react";
import type {
  DriverCharacterConfiguration,
  NormalPose,
  TeamSuitConfiguration,
  WinnerPose,
} from "@/lib/characters/schema";

type CharacterPose = NormalPose | WinnerPose;

type SkinPalette = { light: string; base: string; shadow: string; deep: string; lip: string };
type HairPalette = { light: string; base: string; shadow: string };

const skinColors: Record<DriverCharacterConfiguration["skinTone"], SkinPalette> = {
  TONE_1: { light: "#FFF2E8", base: "#EEC9B0", shadow: "#C99B7D", deep: "#8F604A", lip: "#A86263" },
  TONE_2: { light: "#FBE4D3", base: "#DDB496", shadow: "#B98465", deep: "#7A4E3A", lip: "#9A5A59" },
  TONE_3: { light: "#F1D1B8", base: "#C99673", shadow: "#9E694C", deep: "#6A4232", lip: "#8C4F4E" },
  TONE_4: { light: "#E1B28E", base: "#AE7655", shadow: "#815039", deep: "#533126", lip: "#7A4343" },
  TONE_5: { light: "#C9906B", base: "#915B40", shadow: "#673C2B", deep: "#3F241D", lip: "#6E3A3B" },
  TONE_6: { light: "#A97050", base: "#70432F", shadow: "#4A2B21", deep: "#2D1A16", lip: "#5A3032" },
  TONE_7: { light: "#83553F", base: "#513225", shadow: "#351F19", deep: "#201310", lip: "#49272B" },
  TONE_8: { light: "#65412F", base: "#38241B", shadow: "#241712", deep: "#160E0C", lip: "#3A2024" },
};

const hairColors: Record<DriverCharacterConfiguration["hairColor"], HairPalette> = {
  BLACK: { light: "#343944", base: "#171A20", shadow: "#080A0E" },
  DARK_BROWN: { light: "#5B4033", base: "#302018", shadow: "#140D0A" },
  BROWN: { light: "#8B6245", base: "#573824", shadow: "#28170F" },
  LIGHT_BROWN: { light: "#B58A62", base: "#79583B", shadow: "#3B281B" },
  BLOND: { light: "#E9D29B", base: "#BE9B5F", shadow: "#6E552F" },
  RED: { light: "#B96748", base: "#783A29", shadow: "#371A14" },
  GRAY: { light: "#C7CBD0", base: "#7D828A", shadow: "#3E4249" },
  WHITE: { light: "#FFFFFF", base: "#D8DCE1", shadow: "#8C929A" },
};

const eyeColors: Record<DriverCharacterConfiguration["eyeColor"], string> = {
  BROWN: "#74452F",
  DARK_BROWN: "#35221C",
  BLUE: "#467FA5",
  GREEN: "#52765A",
  GRAY: "#77838D",
  HAZEL: "#81713F",
};

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
  const rawId = useId().replaceAll(":", "");
  const portrait = variant === "portrait" || variant === "tableThumbnail";
  const winner = variant === "winner";
  const skin = skinColors[configuration.skinTone];
  const hair = hairColors[configuration.hairColor];
  const eye = eyeColors[configuration.eyeColor];
  const shoulder = configuration.bodyShape === "STRONG" ? 13 : configuration.bodyShape === "SLIM" ? -9 : configuration.bodyShape === "ATHLETIC" ? 6 : 0;
  const waist = configuration.bodyShape === "STRONG" ? 7 : configuration.bodyShape === "SLIM" ? -6 : 0;
  const helmetWorn = configuration.helmet.mode === "WORN_OPEN" || configuration.helmet.mode === "WORN_CLOSED";
  const helmetCarried = configuration.helmet.mode === "CARRIED" || pose === "HELM_UNDER_ARM" || pose === "HELM_UP";
  const armsRaised = ["BOTH_ARMS_UP", "TROPHY", "CHAMPAGNE", "HELM_UP"].includes(pose);
  const viewBox = portrait ? "78 18 124 150" : "0 0 280 480";
  const facePath = faceShapePath(configuration.faceShape);
  const suitId = `${rawId}-suit`;
  const suitShadeId = `${rawId}-suit-shade`;
  const skinId = `${rawId}-skin`;
  const hairId = `${rawId}-hair`;
  const visorId = `${rawId}-visor`;
  const shadowId = `${rawId}-shadow`;

  return (
    <svg
      role="img"
      aria-label={alt}
      viewBox={viewBox}
      className={`select-none overflow-visible ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={suitId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mixColor(teamSuit.primaryColor, "#FFFFFF", 0.24)} />
          <stop offset="0.42" stopColor={teamSuit.primaryColor} />
          <stop offset="1" stopColor={mixColor(teamSuit.primaryColor, "#020617", 0.46)} />
        </linearGradient>
        <linearGradient id={suitShadeId} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={mixColor(teamSuit.secondaryColor, "#FFFFFF", 0.12)} />
          <stop offset="1" stopColor={mixColor(teamSuit.secondaryColor, "#000000", 0.42)} />
        </linearGradient>
        <radialGradient id={skinId} cx="35%" cy="24%" r="82%">
          <stop offset="0" stopColor={skin.light} />
          <stop offset="0.46" stopColor={skin.base} />
          <stop offset="1" stopColor={skin.shadow} />
        </radialGradient>
        <linearGradient id={hairId} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={hair.light} />
          <stop offset="0.38" stopColor={hair.base} />
          <stop offset="1" stopColor={hair.shadow} />
        </linearGradient>
        <linearGradient id={visorId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D7F4FF" stopOpacity="0.9" />
          <stop offset="0.38" stopColor="#54738A" stopOpacity="0.78" />
          <stop offset="1" stopColor="#07111E" stopOpacity="0.96" />
        </linearGradient>
        <filter id={shadowId} x="-35%" y="-35%" width="170%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#020617" floodOpacity="0.5" />
        </filter>
      </defs>

      {showBackground ? (
        <g aria-hidden="true" data-layer="background">
          <ellipse cx="140" cy="247" rx="125" ry="191" fill={teamSuit.primaryColor} opacity="0.08" />
          <ellipse cx="140" cy="247" rx="101" ry="166" fill="none" stroke={teamSuit.accentColor} strokeOpacity="0.18" strokeWidth="1.5" />
          <path d="M18 400 252 68M55 456 273 146" stroke={teamSuit.accentColor} strokeOpacity="0.12" strokeWidth="2" />
        </g>
      ) : null}
      {showShadow && !portrait ? <ellipse cx="140" cy="458" rx="76" ry="12" fill="#020617" opacity="0.62" filter={`url(#${shadowId})`} /> : null}

      <g aria-hidden="true" data-layer="legs" filter={`url(#${shadowId})`}>
        <path d="M104 277 92 433q12 8 33 1l16-116 14 116q20 7 33-1l-13-156Z" fill={`url(#${suitShadeId})`} stroke="#020617" strokeOpacity="0.5" strokeWidth="2" />
        <path d="m103 315 31 5-14 111H96Z" fill={teamSuit.primaryColor} opacity="0.48" />
        <path d="m177 315-31 5 14 111h24Z" fill={teamSuit.primaryColor} opacity="0.38" />
        <path d="M91 429h35l-2 23H73q1-16 18-23ZM154 429h35q16 7 18 23h-51Z" fill={shoeColor(configuration.shoes, teamSuit)} stroke="#64748B" strokeOpacity="0.36" strokeWidth="2" />
        <path d="M81 443h43M156 443h43" stroke="#E2E8F0" strokeOpacity="0.28" strokeWidth="2" />
      </g>

      <g aria-hidden="true" data-layer="body" filter={`url(#${shadowId})`}>
        <path d={`M${88 - shoulder} 145 Q140 116 ${192 + shoulder} 145 L${181 + waist} 282 Q140 303 ${99 - waist} 282 L${88 - shoulder} 145Z`} fill={`url(#${suitId})`} stroke="#E2E8F0" strokeOpacity="0.24" strokeWidth="2" />
        <path d="M108 134q32 23 64 0l10 25q-42 27-84 0Z" fill={teamSuit.collarColor} opacity="0.96" />
        <path d="M113 138q27 17 54 0l-8 28h-38Z" fill={`url(#${suitShadeId})`} />
        <path d="M139 162v116" stroke="#F8FAFC" strokeOpacity="0.14" strokeWidth="2" />
        <path d="M101 186q38 17 78 0" fill="none" stroke="#F8FAFC" strokeOpacity="0.18" strokeWidth="2" />
        {teamSuit.pattern === "DIAGONAL" ? <path d="m94 188 88-31 7 24-92 34Z" fill={teamSuit.secondaryColor} opacity="0.82" /> : null}
        {teamSuit.pattern === "CENTER_STRIPE" ? <path d="M130 169h20v112h-20Z" fill={teamSuit.secondaryColor} opacity="0.78" /> : null}
        {teamSuit.pattern === "SHOULDER" ? <path d={`M${91 - shoulder} 150q49-28 ${98 + shoulder * 2} 0l-8 22q-41-19-82 0Z`} fill={teamSuit.secondaryColor} opacity="0.88" /> : null}
        {teamSuit.sideStripes || teamSuit.pattern === "SIDE_STRIPES" ? <><path d="m97 171 12 2-2 104-10 4Z" fill={teamSuit.accentColor} opacity="0.88" /><path d="m183 171-12 2 2 104 10 4Z" fill={teamSuit.accentColor} opacity="0.88" /></> : null}
        <path d="M106 239h68" stroke={teamSuit.accentColor} strokeOpacity="0.7" strokeWidth="2" />
        <path d="M111 250h58" stroke="#F8FAFC" strokeOpacity="0.12" strokeWidth="1.5" strokeDasharray="4 4" />
        {teamSuit.chestLogoAsset ? <image href={teamSuit.chestLogoAsset} x="122" y="183" width="36" height="32" preserveAspectRatio="xMidYMid meet" /> : <path d="m140 184 10 10-10 10-10-10Z" fill={teamSuit.accentColor} opacity="0.9" />}
        {teamSuit.smallLogoAssets.slice(0, 2).map((asset, index) => <image key={asset} href={asset} x={index === 0 ? 102 : 158} y="217" width="19" height="14" preserveAspectRatio="xMidYMid meet" />)}
        {driverNumber != null ? <text x="140" y="234" textAnchor="middle" fill="#FFFFFF" fontSize="21" fontWeight="900" fontFamily="ui-monospace, monospace" stroke="#020617" strokeOpacity="0.35" strokeWidth="1">{driverNumber}</text> : null}
      </g>

      <SuitArms pose={pose} shoulder={shoulder} suitId={suitId} suitShadeId={suitShadeId} accent={teamSuit.accentColor} glove={gloveColor(configuration.gloves, teamSuit)} />

      <g aria-hidden="true" data-layer="neck">
        <path d="M125 103v37q15 16 30 0v-37Z" fill={`url(#${skinId})`} stroke={skin.deep} strokeOpacity="0.28" strokeWidth="1.5" />
        <path d="M127 116q13 10 26 0" fill="none" stroke={skin.shadow} strokeOpacity="0.55" strokeWidth="2" />
      </g>

      <g aria-hidden="true" data-layer="face" filter={`url(#${shadowId})`}>
        <path d={facePath} fill={`url(#${skinId})`} stroke={skin.deep} strokeOpacity="0.38" strokeWidth="1.5" />
        <path d="M111 75q-7 5-4 17 2 8 9 8M169 75q7 5 4 17-2 8-9 8" fill={skin.base} stroke={skin.deep} strokeOpacity="0.28" strokeWidth="1.5" />
        <path d="M119 78q9-6 17 0M145 78q8-6 17 0" fill="none" stroke={hair.shadow} strokeLinecap="round" strokeWidth={configuration.eyebrowStyle === "BOLD" ? 4 : configuration.eyebrowStyle === "DEFINED" ? 3 : 2.2} />
        <Eye x={128} y={88} color={eye} shape={configuration.eyeShape} />
        <Eye x={153} y={88} color={eye} shape={configuration.eyeShape} />
        <path d={nosePath(configuration.noseStyle)} fill="none" stroke={skin.deep} strokeOpacity="0.58" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        <path d={mouthPath(configuration.mouthStyle)} fill="none" stroke={skin.lip} strokeLinecap="round" strokeWidth="2" />
        <path d="M124 115q16 7 32 0" fill="none" stroke={skin.deep} strokeOpacity="0.16" />
        <path d="M116 67q24-16 48 0" fill="none" stroke={skin.light} strokeOpacity="0.18" strokeWidth="3" />
        <FaceDetail detail={configuration.faceDetail} color={skin.deep} />
        <Beard style={configuration.beardStyle} hairId={hairId} opacity={configuration.beardStyle === "LIGHT" ? 0.28 : configuration.beardStyle === "STUBBLE" ? 0.46 : 0.88} />
        <Eyewear style={configuration.eyewearStyle} />
      </g>

      {!helmetWorn ? <Hair style={configuration.hairStyle} hairId={hairId} highlight={hair.light} /> : null}
      {helmetWorn ? <Helmet configuration={configuration} x={140} y={72} visorId={visorId} shadowId={shadowId} worn /> : null}
      {helmetCarried && !helmetWorn ? <Helmet configuration={configuration} x={armsRaised ? 223 : 198} y={armsRaised ? 62 : 255} visorId={visorId} shadowId={shadowId} /> : null}
      {pose === "TROPHY" ? <Trophy /> : null}
      {pose === "CHAMPAGNE" ? <Champagne /> : null}
      {winner ? <path d="M51 456h178" stroke={teamSuit.accentColor} strokeOpacity="0.48" strokeWidth="2" /> : null}
      {!portrait && configuration.helmet.showInitials && driverInitials ? <text x="140" y="264" textAnchor="middle" fill={teamSuit.accentColor} fontSize="9" fontWeight="800" letterSpacing="1.4">{driverInitials.slice(0, 3).toUpperCase()}</text> : null}
    </svg>
  );
}

function SuitArms({ pose, shoulder, suitId, suitShadeId, accent, glove }: { pose: CharacterPose; shoulder: number; suitId: string; suitShadeId: string; accent: string; glove: string }) {
  const raised = ["BOTH_ARMS_UP", "TROPHY", "CHAMPAGNE", "HELM_UP"].includes(pose);
  if (raised) return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d={`M${96 - shoulder} 157 59 110 48 51`} stroke={`url(#${suitId})`} strokeWidth="25" /><path d={`M${184 + shoulder} 157 221 110 232 51`} stroke={`url(#${suitId})`} strokeWidth="25" /><path d="m61 109-13-58M219 109l13-58" stroke={accent} strokeOpacity="0.75" strokeWidth="3" /><RealisticGlove x={47} y={43} fill={glove} /><RealisticGlove x={233} y={43} fill={glove} /></g>;
  if (pose === "FIST_UP" || pose === "POINT_NUMBER_ONE" || pose === "THUMBS_UP") return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d={`M${96 - shoulder} 158 77 238`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d={`M${184 + shoulder} 158 213 103 220 49`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d="m211 107 9-58" stroke={accent} strokeOpacity="0.75" strokeWidth="3" /><RealisticGlove x={76} y={246} fill={glove} /><RealisticGlove x={221} y={41} fill={glove} pointing={pose === "POINT_NUMBER_ONE"} /></g>;
  if (pose === "ARMS_CROSSED") return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d="M94 164q43 64 103 24" stroke={`url(#${suitId})`} strokeWidth="27" /><path d="M186 164q-40 63-101 27" stroke={`url(#${suitShadeId})`} strokeWidth="24" /><RealisticGlove x={191} y={190} fill={glove} /><RealisticGlove x={88} y={193} fill={glove} /></g>;
  if (pose === "HANDS_ON_HIPS") return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d="M94 158 70 217l25 38" stroke={`url(#${suitId})`} strokeWidth="25" /><path d="m186 158 24 59-25 38" stroke={`url(#${suitId})`} strokeWidth="25" /><RealisticGlove x={98} y={256} fill={glove} /><RealisticGlove x={182} y={256} fill={glove} /></g>;
  return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d={`M${96 - shoulder} 158 73 273`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d={`M${184 + shoulder} 158 207 273`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d="m88 185-15 88M192 185l15 88" stroke={accent} strokeOpacity="0.68" strokeWidth="3" /><RealisticGlove x={72} y={282} fill={glove} /><RealisticGlove x={208} y={282} fill={glove} /></g>;
}

function RealisticGlove({ x, y, fill, pointing = false }: { x: number; y: number; fill: string; pointing?: boolean }) {
  return <g transform={`translate(${x} ${y})`}><path d={pointing ? "M-8 9Q-12 1-6-6L-2-22Q0-27 3-22L4-8Q11-12 13-5L12 7Q5 16-8 9Z" : "M-10 8Q-13-1-7-8L-2-13Q1-17 3-11 8-16 11-9 16-11 16-4l-2 13Q3 17-10 8Z"} fill={fill} stroke="#020617" strokeOpacity="0.55" strokeWidth="1.5" /><path d="M-5 2Q3 7 11 1" fill="none" stroke="#F8FAFC" strokeOpacity="0.28" /></g>;
}

function Eye({ x, y, color, shape }: { x: number; y: number; color: string; shape: DriverCharacterConfiguration["eyeShape"] }) {
  const height = shape === "NARROW" ? 2.5 : shape === "ROUND" ? 4.5 : 3.6;
  const width = shape === "DEEP" ? 8 : 7;
  return <g><path d={`M${x - width} ${y}Q${x} ${y - height - 1} ${x + width} ${y}Q${x} ${y + height} ${x - width} ${y}Z`} fill="#F4EEE8" stroke="#3F2A23" strokeOpacity="0.55" strokeWidth="1" /><circle cx={x} cy={y} r="3.1" fill={color} /><circle cx={x} cy={y} r="1.45" fill="#090B0E" /><circle cx={x - 0.8} cy={y - 1} r="0.65" fill="#FFFFFF" opacity="0.82" /></g>;
}

function Hair({ style, hairId, highlight }: { style: DriverCharacterConfiguration["hairStyle"]; hairId: string; highlight: string }) {
  if (style === "BALD") return <path d="M113 60q27-24 54 0" fill="none" stroke={highlight} strokeOpacity="0.12" strokeWidth="2" />;
  const path = style === "UNDERCUT" ? "M109 69q1-40 31-44 27 2 34 34l-18-10-43 23Z" : style === "CURLY" ? "M108 67q-1-36 30-43 34 0 35 39-10-13-17-7-6-14-15-4-9-12-16-2-7-4-17 11Z" : style === "LONG" ? "M108 66q1-38 31-42 34 2 35 40l-8 63-13-25-42 21-4-52Z" : style === "SIDE_PART" ? "M109 66q1-35 31-41 27 2 34 33-22-13-39-7-61 15Z" : style === "SLICKED" ? "M110 64q7-36 33-39 25 4 31 34-21-17-41-18-64 5Z" : style === "MEDIUM" ? "M108 67q1-39 31-43 32 2 35 39l-6 35-8-21q-17-18-48 1l-5 21Z" : style === "STRAIGHT" ? "M109 67q0-38 31-43 31 2 34 39l-8 25q-14-27-54-10Z" : "M110 65q3-35 30-40 29 3 34 35-20-12-42-13-64 5Z";
  return <g aria-hidden="true" data-layer="hair"><path d={path} fill={`url(#${hairId})`} stroke="#020617" strokeOpacity="0.4" strokeWidth="1.5" /><path d="M119 48q19-15 39-5" fill="none" stroke={highlight} strokeOpacity="0.34" strokeLinecap="round" strokeWidth="2.2" /><path d="M116 56q23-17 48-6" fill="none" stroke={highlight} strokeOpacity="0.18" strokeLinecap="round" /></g>;
}

function Beard({ style, hairId, opacity }: { style: DriverCharacterConfiguration["beardStyle"]; hairId: string; opacity: number }) {
  if (style === "NONE") return null;
  if (style === "MOUSTACHE") return <path d="M128 106q12-6 24 0-4 8-12 3-8 5-12-3Z" fill={`url(#${hairId})`} opacity={opacity} />;
  if (style === "GOATEE") return <path d="M132 107q8 5 16 0l-3 19h-10Z" fill={`url(#${hairId})`} opacity={opacity} />;
  return <path d={style === "FULL" ? "M114 99q3 28 26 35 23-7 26-35-9 10-13 20-13 11-26 0-4-10-13-20Z" : "M117 105q5 22 23 25 18-3 23-25-9 13-23 14-14-1-23-14Z"} fill={`url(#${hairId})`} opacity={opacity} />;
}

function Eyewear({ style }: { style: DriverCharacterConfiguration["eyewearStyle"] }) {
  if (style === "NONE") return null;
  return <g fill={style === "SUNGLASSES" ? "#07101F" : "none"} fillOpacity="0.9" stroke={style === "SUNGLASSES" ? "#64748B" : "#CBD5E1"} strokeWidth="1.8"><rect x="117" y="79" width="22" height="17" rx="5" /><rect x="142" y="79" width="22" height="17" rx="5" /><path d="M139 85h3M116 83l-6-2M165 83l6-2" /></g>;
}

function FaceDetail({ detail, color }: { detail: DriverCharacterConfiguration["faceDetail"]; color: string }) {
  if (detail === "FRECKLES") return <g fill={color} opacity="0.42"><circle cx="120" cy="98" r="0.8" /><circle cx="124" cy="100" r="0.7" /><circle cx="157" cy="99" r="0.8" /><circle cx="161" cy="97" r="0.7" /></g>;
  if (detail === "CHEEK_MARK") return <path d="m160 98 6 5" stroke={color} strokeOpacity="0.45" strokeWidth="1.2" />;
  if (detail === "BROW_MARK") return <path d="m156 72 5 7" stroke={color} strokeOpacity="0.5" strokeWidth="1.2" />;
  return null;
}

function Helmet({ configuration, x, y, visorId, shadowId, worn = false }: { configuration: DriverCharacterConfiguration; x: number; y: number; visorId: string; shadowId: string; worn?: boolean }) {
  const scale = worn ? 1.02 : 0.7;
  return <g aria-hidden="true" data-layer="helmet" transform={`translate(${x} ${y}) scale(${scale}) translate(-140 -72)`} filter={`url(#${shadowId})`}><path d="M105 80q1-47 35-56 38 7 38 54l-12 35h-53Z" fill={configuration.helmet.primaryColor} stroke={configuration.helmet.accentColor} strokeWidth="3" /><path d="M111 67q29-21 60 1l-7 27h-50Z" fill={`url(#${visorId})`} stroke="#D7F4FF" strokeOpacity="0.42" strokeWidth="1.5" /><path d="M112 50q28-19 56 2" fill="none" stroke={configuration.helmet.secondaryColor} strokeWidth={configuration.helmet.pattern === "NONE" ? 2 : 7} /><path d="M115 106h49" stroke={configuration.helmet.secondaryColor} strokeWidth="4" /><path d="M105 83q35 13 72-2" fill="none" stroke={configuration.helmet.accentColor} strokeOpacity="0.7" strokeWidth="2" />{configuration.helmet.finish === "GLOSS" ? <path d="M121 38q21-12 37 1" fill="none" stroke="#FFFFFF" strokeOpacity="0.45" strokeLinecap="round" strokeWidth="3" /> : null}</g>;
}

function Trophy() { return <g aria-hidden="true" data-layer="winner-prop" transform="translate(140 57)"><path d="M-18-10h36q0 31-18 37-18-6-18-37Z" fill="#D6A928" stroke="#FFE59A" strokeWidth="2" /><path d="M-18-4q-17 0-11 16 5 10 17 6M18-4q17 0 11 16-5 10-17 6M0 27v13M-15 41h30" fill="none" stroke="#FFE59A" strokeWidth="4" strokeLinecap="round" /></g>; }
function Champagne() { return <g aria-hidden="true" data-layer="winner-prop" transform="translate(210 70) rotate(-22)"><path d="M-7-25h14l4 58H-11Z" fill="#315E3A" stroke="#D8B45B" strokeWidth="2" /><path d="M-7-25h14v13H-7Z" fill="#D8B45B" /><path d="M0-30q18-18 30-5M2-27q25-5 31 7" fill="none" stroke="#D8F4FF" strokeOpacity="0.8" strokeWidth="2" /></g>; }

function faceShapePath(shape: DriverCharacterConfiguration["faceShape"]): string {
  if (shape === "ROUND") return "M110 60q5-34 30-35 27 1 31 35v28q-1 36-31 44-30-8-31-44Z";
  if (shape === "ANGULAR") return "M111 58q6-32 29-34 26 2 30 34l-4 45-26 30-26-30Z";
  if (shape === "NARROW") return "M115 57q4-31 25-33 22 2 25 33l-3 47-22 30-22-30Z";
  if (shape === "WIDE") return "M106 61q6-34 34-36 30 2 35 36l-5 42-30 28-30-28Z";
  return "M111 57q5-32 29-34 26 2 30 34l-3 42q-7 29-27 34-20-5-27-34Z";
}

function nosePath(style: DriverCharacterConfiguration["noseStyle"]): string {
  if (style === "WIDE") return "M139 88 135 103q5 4 12 0";
  if (style === "NARROW") return "M140 88 138 104h6";
  if (style === "SOFT") return "M139 89q-3 11-1 15 5 3 9-1";
  return "M140 88 137 104h9";
}

function mouthPath(style: DriverCharacterConfiguration["mouthStyle"]): string {
  if (style === "SMILE") return "M129 112q11 8 22 0";
  if (style === "FOCUSED") return "M130 113h20";
  if (style === "CONFIDENT") return "M130 114q11 3 21-2";
  return "M130 113q10 2 20 0";
}

function gloveColor(value: DriverCharacterConfiguration["gloves"], suit: TeamSuitConfiguration): string {
  return value === "WHITE" ? "#E5E7EB" : value === "BLACK" ? "#111827" : suit.accentColor;
}

function shoeColor(value: DriverCharacterConfiguration["shoes"], suit: TeamSuitConfiguration): string {
  return value === "WHITE" ? "#E5E7EB" : value === "TEAM" ? mixColor(suit.secondaryColor, suit.accentColor, 0.26) : "#0B1019";
}

function mixColor(first: string, second: string, amount: number): string {
  const parse = (value: string) => [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)];
  const [r1, g1, b1] = parse(first);
  const [r2, g2, b2] = parse(second);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * amount).toString(16).padStart(2, "0");
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

const DriverCharacter = memo(DriverCharacterComponent);
export default DriverCharacter;
