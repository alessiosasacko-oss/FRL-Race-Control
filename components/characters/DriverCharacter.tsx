import { memo, useId, type CSSProperties } from "react";
import type {
  DriverCharacterConfiguration,
  NormalPose,
  TeamSuitConfiguration,
  WinnerPose,
} from "@/lib/characters/schema";

type CharacterPose = NormalPose | WinnerPose;
export type DriverCharacterVariant =
  | "head"
  | "portrait"
  | "halfBody"
  | "fullBody"
  | "tableThumbnail"
  | "winner"
  | "dashboardHero";

type SkinPalette = { light: string; base: string; shadow: string; deep: string; lip: string; blush: string };
type HairPalette = { light: string; base: string; shadow: string };

const skinColors: Record<DriverCharacterConfiguration["skinTone"], SkinPalette> = {
  TONE_1: { light: "#FFF6EE", base: "#EEC9B0", shadow: "#C89677", deep: "#81513E", lip: "#9D5C60", blush: "#D99586" },
  TONE_2: { light: "#FCE8D8", base: "#DDB496", shadow: "#B77F61", deep: "#704533", lip: "#945557", blush: "#C77F70" },
  TONE_3: { light: "#F3D6BF", base: "#C99673", shadow: "#9D684A", deep: "#603B2D", lip: "#884B4D", blush: "#AE695D" },
  TONE_4: { light: "#E5B995", base: "#AE7655", shadow: "#7D4C36", deep: "#4A2B22", lip: "#743F42", blush: "#945849" },
  TONE_5: { light: "#CD9670", base: "#915B40", shadow: "#623927", deep: "#382019", lip: "#69373B", blush: "#7F473B" },
  TONE_6: { light: "#AE7755", base: "#70432F", shadow: "#48291F", deep: "#291713", lip: "#572E32", blush: "#63382F" },
  TONE_7: { light: "#895A42", base: "#513225", shadow: "#331E18", deep: "#1C100D", lip: "#47252A", blush: "#4F2D26" },
  TONE_8: { light: "#684531", base: "#38241B", shadow: "#231611", deep: "#120B09", lip: "#381E23", blush: "#3F251F" },
};

const hairColors: Record<DriverCharacterConfiguration["hairColor"], HairPalette> = {
  BLACK: { light: "#3A404B", base: "#171A20", shadow: "#07090D" },
  DARK_BROWN: { light: "#654739", base: "#302018", shadow: "#130C09" },
  BROWN: { light: "#956B4C", base: "#573824", shadow: "#27170E" },
  LIGHT_BROWN: { light: "#C0976C", base: "#79583B", shadow: "#392719" },
  BLOND: { light: "#F0DCA8", base: "#BE9B5F", shadow: "#68502C" },
  RED: { light: "#C47150", base: "#783A29", shadow: "#351813" },
  GRAY: { light: "#D1D4D8", base: "#7D828A", shadow: "#3A3E45" },
  WHITE: { light: "#FFFFFF", base: "#D8DCE1", shadow: "#898F98" },
};

const eyeColors: Record<DriverCharacterConfiguration["eyeColor"], string> = {
  BROWN: "#74452F",
  DARK_BROWN: "#35221C",
  BLUE: "#477FA5",
  GREEN: "#52765A",
  GRAY: "#77838D",
  HAZEL: "#81713F",
};

export type DriverCharacterProps = {
  configuration: DriverCharacterConfiguration;
  teamSuit: TeamSuitConfiguration;
  pose?: CharacterPose;
  variant?: DriverCharacterVariant;
  driverNumber?: number | null;
  driverInitials?: string;
  teamLogoUrl?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
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
  teamLogoUrl,
  alt,
  className = "",
  style,
  showShadow = true,
  showBackground = false,
}: DriverCharacterProps) {
  const rawId = useId().replaceAll(":", "");
  const ids = {
    suit: `${rawId}-suit`,
    suitShade: `${rawId}-suit-shade`,
    skin: `${rawId}-skin`,
    skinShade: `${rawId}-skin-shade`,
    hair: `${rawId}-hair`,
    visor: `${rawId}-visor`,
    shadow: `${rawId}-shadow`,
    fabric: `${rawId}-fabric`,
  };
  const headOnly = variant === "head" || variant === "tableThumbnail";
  const fullLength = variant === "fullBody" || variant === "winner" || variant === "dashboardHero";
  const winner = variant === "winner";
  const skin = skinColors[configuration.skinTone];
  const hair = hairColors[configuration.hairColor];
  const body = bodyDimensions(configuration.bodyShape);
  const helmetWorn = configuration.helmet.mode === "WORN_OPEN" || configuration.helmet.mode === "WORN_CLOSED";
  const helmetCarried = configuration.helmet.mode === "CARRIED" || pose === "HELM_UNDER_ARM" || pose === "HELM_UP";
  const armsRaised = ["BOTH_ARMS_UP", "TROPHY", "CHAMPAGNE", "HELM_UP"].includes(pose);

  return (
    <svg role="img" aria-label={alt} viewBox={variantViewBox(variant)} className={`select-none overflow-visible ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={ids.suit} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={mixColor(teamSuit.primaryColor, "#FFFFFF", 0.3)} /><stop offset="0.32" stopColor={teamSuit.primaryColor} /><stop offset="0.72" stopColor={mixColor(teamSuit.primaryColor, teamSuit.secondaryColor, 0.34)} /><stop offset="1" stopColor={mixColor(teamSuit.primaryColor, "#020617", 0.55)} /></linearGradient>
        <linearGradient id={ids.suitShade} x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor={mixColor(teamSuit.secondaryColor, "#FFFFFF", 0.16)} /><stop offset="0.52" stopColor={teamSuit.secondaryColor} /><stop offset="1" stopColor={mixColor(teamSuit.secondaryColor, "#000000", 0.5)} /></linearGradient>
        <radialGradient id={ids.skin} cx="34%" cy="21%" r="88%"><stop offset="0" stopColor={skin.light} /><stop offset="0.42" stopColor={skin.base} /><stop offset="0.78" stopColor={skin.shadow} /><stop offset="1" stopColor={mixColor(skin.shadow, skin.deep, 0.45)} /></radialGradient>
        <linearGradient id={ids.skinShade} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={skin.base} /><stop offset="1" stopColor={skin.shadow} /></linearGradient>
        <linearGradient id={ids.hair} x1="0" y1="0" x2="0.75" y2="1"><stop offset="0" stopColor={hair.light} /><stop offset="0.36" stopColor={hair.base} /><stop offset="1" stopColor={hair.shadow} /></linearGradient>
        <linearGradient id={ids.visor} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E5F8FF" stopOpacity="0.94" /><stop offset="0.36" stopColor="#57778E" stopOpacity="0.8" /><stop offset="1" stopColor="#050B13" stopOpacity="0.97" /></linearGradient>
        <pattern id={ids.fabric} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0v7" stroke="#FFFFFF" strokeOpacity="0.045" strokeWidth="1" /></pattern>
        <filter id={ids.shadow} x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#020617" floodOpacity="0.52" /></filter>
      </defs>

      {showBackground ? <CharacterBackground teamSuit={teamSuit} /> : null}
      {showShadow && fullLength ? <ellipse cx="140" cy="475" rx="77" ry="12" fill="#020617" opacity="0.68" filter={`url(#${ids.shadow})`} /> : null}
      {fullLength ? <SuitLegs configuration={configuration} teamSuit={teamSuit} ids={ids} /> : null}
      <DriverSuitTorso teamSuit={teamSuit} ids={ids} body={body} driverNumber={driverNumber} teamLogoUrl={teamLogoUrl} compact={headOnly} />
      {!headOnly ? <SuitArms pose={pose} shoulder={body.shoulder} suitId={ids.suit} suitShadeId={ids.suitShade} accent={teamSuit.accentColor} glove={gloveColor(configuration.gloves, teamSuit)} /> : null}

      <g aria-hidden="true" data-layer="neck"><path d="M129 99v47q11 12 22 0V99Z" fill={`url(#${ids.skinShade})`} stroke={skin.deep} strokeOpacity="0.3" strokeWidth="1.4" /><path d="M130 116q10 8 20 0" fill="none" stroke={skin.deep} strokeOpacity="0.34" strokeWidth="1.8" /><path d="M128 139q12 12 24 0" fill="none" stroke="#020617" strokeOpacity="0.23" strokeWidth="4" /></g>
      <g aria-hidden="true" data-layer="head" transform="translate(44 12) scale(.685)">
        <CharacterHead configuration={configuration} skin={skin} hair={hair} eye={eyeColors[configuration.eyeColor]} ids={ids} />
        {!helmetWorn ? <Hair style={configuration.hairStyle} hairId={ids.hair} palette={hair} /> : null}
        {helmetWorn ? <Helmet configuration={configuration} x={140} y={72} visorId={ids.visor} shadowId={ids.shadow} worn /> : null}
      </g>
      {helmetCarried && !helmetWorn && !headOnly ? <Helmet configuration={configuration} x={armsRaised ? 223 : 198} y={armsRaised ? 62 : 258} visorId={ids.visor} shadowId={ids.shadow} /> : null}
      {pose === "TROPHY" && !headOnly ? <Trophy /> : null}
      {pose === "CHAMPAGNE" && !headOnly ? <Champagne /> : null}
      {winner ? <path d="M50 474h180" stroke={teamSuit.accentColor} strokeOpacity="0.5" strokeWidth="2" /> : null}
      {!headOnly && configuration.helmet.showInitials && driverInitials ? <text x="140" y="267" textAnchor="middle" fill={teamSuit.accentColor} fontSize="9" fontWeight="800" letterSpacing="1.4">{driverInitials.slice(0, 3).toUpperCase()}</text> : null}
    </svg>
  );
}

function CharacterBackground({ teamSuit }: { teamSuit: TeamSuitConfiguration }) {
  return <g aria-hidden="true" data-layer="background"><ellipse cx="140" cy="253" rx="126" ry="205" fill={teamSuit.primaryColor} opacity="0.09" /><ellipse cx="140" cy="253" rx="102" ry="178" fill="none" stroke={teamSuit.accentColor} strokeOpacity="0.2" strokeWidth="1.5" /><path d="M12 422 252 65M50 486 276 135" stroke={teamSuit.accentColor} strokeOpacity="0.12" strokeWidth="2" /><path d="M28 386h224M47 414h186" stroke="#FFFFFF" strokeOpacity="0.045" strokeDasharray="6 8" /></g>;
}

function SuitLegs({ configuration, teamSuit, ids }: { configuration: DriverCharacterConfiguration; teamSuit: TeamSuitConfiguration; ids: Record<string, string> }) {
  return <g aria-hidden="true" data-layer="legs" filter={`url(#${ids.shadow})`}><path d="M101 286 89 448q12 10 35 2l16-119 17 119q23 8 35-2l-13-162Z" fill={`url(#${ids.suitShade})`} stroke="#020617" strokeOpacity="0.55" strokeWidth="2" /><path d="m101 321 34 7-15 119H94Z" fill={teamSuit.primaryColor} opacity="0.52" /><path d="m179 321-34 7 15 119h26Z" fill={teamSuit.primaryColor} opacity="0.42" /><path d="M99 323q18 10 36 5M145 328q18 5 35-5M96 382q15 8 30 3M154 385q16 5 31-3" fill="none" stroke="#FFFFFF" strokeOpacity="0.13" strokeWidth="2" /><path d="M139 316v137" stroke="#020617" strokeOpacity="0.34" strokeWidth="2" />{teamSuit.sideStripes ? <><path d="m95 302 8 1-8 139-7 4Z" fill={teamSuit.accentColor} opacity="0.85" /><path d="m185 302-8 1 8 139 7 4Z" fill={teamSuit.accentColor} opacity="0.85" /></> : null}<path d="M87 445h39l-2 25H69q2-18 18-25ZM154 445h39q16 8 18 25h-55Z" fill={shoeColor(configuration.shoes, teamSuit)} stroke="#94A3B8" strokeOpacity="0.4" strokeWidth="2" /><path d="M77 461h47M156 461h47" stroke="#E2E8F0" strokeOpacity="0.3" strokeWidth="2" /></g>;
}

function DriverSuitTorso({ teamSuit, ids, body, driverNumber, teamLogoUrl, compact }: { teamSuit: TeamSuitConfiguration; ids: Record<string, string>; body: { shoulder: number; waist: number }; driverNumber?: number | null; teamLogoUrl?: string | null; compact: boolean }) {
  const torsoPath = `M${86 - body.shoulder} 143 Q140 116 ${194 + body.shoulder} 143 L${182 + body.waist} 301 Q140 320 ${98 - body.waist} 301 L${86 - body.shoulder} 143Z`;
  return <g aria-hidden="true" data-layer="body" filter={`url(#${ids.shadow})`}><path d={torsoPath} fill={`url(#${ids.suit})`} stroke="#E2E8F0" strokeOpacity="0.25" strokeWidth="2" /><path d={torsoPath} fill={`url(#${ids.fabric})`} /><path d="M107 133q33 24 66 0l11 28q-44 28-88 0Z" fill={teamSuit.collarColor} opacity="0.98" /><path d="M114 137q26 16 52 0l-7 30h-38Z" fill={`url(#${ids.suitShade})`} /><path d="M139 163v135" stroke="#F8FAFC" strokeOpacity="0.22" strokeWidth="2" /><path d="M143 167v128" stroke="#020617" strokeOpacity="0.32" strokeWidth="1.2" strokeDasharray="3 3" /><path d="M100 188q40 18 80 0M105 244q35 12 70 0M108 273q32 9 64 0" fill="none" stroke="#F8FAFC" strokeOpacity="0.16" strokeWidth="2" />{teamSuit.pattern === "DIAGONAL" ? <path d="m92 190 92-33 8 25-96 36Z" fill={teamSuit.secondaryColor} opacity="0.84" /> : null}{teamSuit.pattern === "CENTER_STRIPE" ? <path d="M128 166h24v135h-24Z" fill={teamSuit.secondaryColor} opacity="0.8" /> : null}{teamSuit.pattern === "SHOULDER" ? <path d={`M${89 - body.shoulder} 149q51-29 ${102 + body.shoulder * 2} 0l-9 24q-42-20-84 0Z`} fill={teamSuit.secondaryColor} opacity="0.9" /> : null}{teamSuit.sideStripes || teamSuit.pattern === "SIDE_STRIPES" ? <><path d="m95 171 13 3-3 121-11 5Z" fill={teamSuit.accentColor} opacity="0.9" /><path d="m185 171-13 3 3 121 11 5Z" fill={teamSuit.accentColor} opacity="0.9" /></> : null}<path d="M100 165q8-17 26-24M180 165q-8-17-26-24" fill="none" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="2" /><path d="M103 208h27M150 208h27" stroke={teamSuit.accentColor} strokeOpacity="0.45" strokeWidth="1.5" />{!compact && (teamLogoUrl || teamSuit.chestLogoAsset) ? <image href={teamLogoUrl ?? teamSuit.chestLogoAsset ?? undefined} x="119" y="184" width="42" height="31" preserveAspectRatio="xMidYMid meet" /> : !compact ? <path d="m140 186 10 10-10 10-10-10Z" fill={teamSuit.accentColor} opacity="0.92" /> : null}{!compact ? teamSuit.smallLogoAssets.slice(0, 2).map((asset, index) => <image key={asset} href={asset} x={index === 0 ? 101 : 160} y="220" width="19" height="14" preserveAspectRatio="xMidYMid meet" />) : null}{!compact && driverNumber != null ? <text x="140" y="244" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900" fontFamily="ui-monospace, monospace" stroke="#020617" strokeOpacity="0.42" strokeWidth="1.2">{driverNumber}</text> : null}<path d="M104 286q36 15 72 0" fill="none" stroke="#020617" strokeOpacity="0.35" strokeWidth="3" /></g>;
}

function CharacterHead({ configuration, skin, hair, eye, ids }: { configuration: DriverCharacterConfiguration; skin: SkinPalette; hair: HairPalette; eye: string; ids: Record<string, string> }) {
  return <g aria-hidden="true" data-layer="face" filter={`url(#${ids.shadow})`}><path data-layer="skin" d={faceShapePath(configuration.faceShape, configuration.jawStyle)} fill={`url(#${ids.skin})`} stroke={skin.deep} strokeOpacity="0.42" strokeWidth="1.7" /><path d="M111 75q-8 5-5 18 3 9 10 8M169 75q8 5 5 18-3 9-10 8" fill={skin.base} stroke={skin.deep} strokeOpacity="0.3" strokeWidth="1.6" /><CheekShading style={configuration.cheekStyle} skin={skin} /><path d="M119 78q9-6 17 0M145 78q8-6 17 0" fill="none" stroke={hair.shadow} strokeLinecap="round" strokeWidth={configuration.eyebrowStyle === "BOLD" ? 4.2 : configuration.eyebrowStyle === "DEFINED" ? 3.2 : configuration.eyebrowStyle === "STRAIGHT" ? 2.5 : 2.2} /><path d="M119 81q9-4 17 0M145 81q8-4 17 0" fill="none" stroke={skin.deep} strokeOpacity="0.15" strokeWidth="2" /><Eye x={128} y={89} color={eye} shape={configuration.eyeShape} /><Eye x={153} y={89} color={eye} shape={configuration.eyeShape} /><path d={nosePath(configuration.noseStyle)} fill="none" stroke={skin.deep} strokeOpacity="0.62" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" /><path d="M143 88q7 11 2 19" fill="none" stroke={skin.shadow} strokeOpacity="0.28" strokeWidth="2.4" /><path d={mouthPath(configuration.mouthStyle)} fill="none" stroke={skin.lip} strokeLinecap="round" strokeWidth="2.15" /><path d="M132 115q8 4 16-1" fill="none" stroke={skin.light} strokeOpacity="0.24" strokeWidth="0.9" /><path d={jawLinePath(configuration.jawStyle)} fill="none" stroke={skin.deep} strokeOpacity="0.24" strokeLinecap="round" strokeWidth="1.4" /><path d="M116 66q24-15 48 0" fill="none" stroke={skin.light} strokeOpacity="0.2" strokeWidth="3" /><path d="M121 127q19 12 38 0" fill="none" stroke={skin.deep} strokeOpacity="0.2" strokeWidth="3" /><FaceDetail detail={configuration.faceDetail} color={skin.deep} /><Beard style={configuration.beardStyle} hairId={ids.hair} /><Eyewear style={configuration.eyewearStyle} /></g>;
}

function CheekShading({ style, skin }: { style: DriverCharacterConfiguration["cheekStyle"]; skin: SkinPalette }) {
  const opacity = style === "SCULPTED" ? 0.34 : style === "LEAN" ? 0.26 : style === "FULL" ? 0.13 : 0.19;
  const path = style === "FULL" ? "M113 96q10 14 20 13M167 96q-10 14-20 13" : "M114 99q10 8 18 6M166 99q-10 8-18 6";
  return <g data-layer="cheeks"><path d={path} fill="none" stroke={skin.shadow} strokeOpacity={opacity} strokeWidth={style === "SCULPTED" ? 4 : 3} strokeLinecap="round" /><path d="M116 93q7-5 13-2M164 93q-7-5-13-2" fill="none" stroke={skin.blush} strokeOpacity="0.16" strokeWidth="3" /></g>;
}

function SuitArms({ pose, shoulder, suitId, suitShadeId, accent, glove }: { pose: CharacterPose; shoulder: number; suitId: string; suitShadeId: string; accent: string; glove: string }) {
  const raised = ["BOTH_ARMS_UP", "TROPHY", "CHAMPAGNE", "HELM_UP"].includes(pose);
  if (raised) return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d={`M${95 - shoulder} 157 58 110 47 51`} stroke={`url(#${suitId})`} strokeWidth="25" /><path d={`M${185 + shoulder} 157 222 110 233 51`} stroke={`url(#${suitId})`} strokeWidth="25" /><path d="m60 109-13-58M220 109l13-58" stroke={accent} strokeOpacity="0.76" strokeWidth="3" /><path d="M70 124q-8 8-14 16M210 124q8 8 14 16" stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth="2" /><RealisticGlove x={46} y={43} fill={glove} /><RealisticGlove x={234} y={43} fill={glove} /></g>;
  if (pose === "FIST_UP" || pose === "POINT_NUMBER_ONE" || pose === "THUMBS_UP") return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d={`M${95 - shoulder} 158 76 248`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d={`M${185 + shoulder} 158 214 103 221 49`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d="m212 107 9-58" stroke={accent} strokeOpacity="0.76" strokeWidth="3" /><path d="M82 216q-6 9-8 18" stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth="2" /><RealisticGlove x={75} y={257} fill={glove} /><RealisticGlove x={222} y={41} fill={glove} pointing={pose === "POINT_NUMBER_ONE"} /></g>;
  if (pose === "ARMS_CROSSED") return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d="M93 164q44 67 105 25" stroke={`url(#${suitId})`} strokeWidth="27" /><path d="M187 164q-41 65-103 28" stroke={`url(#${suitShadeId})`} strokeWidth="24" /><path d="M107 190q27 15 52 12" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="2" /><RealisticGlove x={192} y={191} fill={glove} /><RealisticGlove x={87} y={194} fill={glove} /></g>;
  if (pose === "HANDS_ON_HIPS") return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d="M93 158 68 220l27 40" stroke={`url(#${suitId})`} strokeWidth="25" /><path d="m187 158 25 62-27 40" stroke={`url(#${suitId})`} strokeWidth="25" /><path d="M73 215q10 3 18 8M207 215q-10 3-18 8" stroke={accent} strokeOpacity="0.7" strokeWidth="3" /><RealisticGlove x={98} y={261} fill={glove} /><RealisticGlove x={182} y={261} fill={glove} /></g>;
  return <g aria-hidden="true" data-layer="arms" strokeLinecap="round" strokeLinejoin="round"><path d={`M${95 - shoulder} 158 71 283`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d={`M${185 + shoulder} 158 209 283`} stroke={`url(#${suitId})`} strokeWidth="26" /><path d="m87 186-16 97M193 186l16 97" stroke={accent} strokeOpacity="0.7" strokeWidth="3" /><path d="M77 237q8 4 14 2M203 239q7 2 14-2" stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth="2" /><RealisticGlove x={70} y={292} fill={glove} /><RealisticGlove x={210} y={292} fill={glove} /></g>;
}

function RealisticGlove({ x, y, fill, pointing = false }: { x: number; y: number; fill: string; pointing?: boolean }) {
  return <g transform={`translate(${x} ${y})`} data-layer="gloves"><path d={pointing ? "M-8 9Q-12 1-6-6L-2-22Q0-27 3-22L4-8Q11-12 13-5L12 7Q5 16-8 9Z" : "M-10 8Q-13-1-7-8L-2-13Q1-17 3-11 8-16 11-9 16-11 16-4l-2 13Q3 17-10 8Z"} fill={fill} stroke="#020617" strokeOpacity="0.58" strokeWidth="1.5" /><path d="M-5 2Q3 7 11 1M-2-7 1 2M4-8 6 2" fill="none" stroke="#F8FAFC" strokeOpacity="0.28" /></g>;
}

function Eye({ x, y, color, shape }: { x: number; y: number; color: string; shape: DriverCharacterConfiguration["eyeShape"] }) {
  const height = shape === "NARROW" ? 2.35 : shape === "ROUND" ? 4.1 : shape === "DEEP" ? 3.1 : 3.45;
  const width = shape === "DEEP" ? 7.8 : 7.2;
  return <g data-layer="eyes"><path d={`M${x - width} ${y}Q${x} ${y - height - 0.8} ${x + width} ${y}Q${x} ${y + height} ${x - width} ${y}Z`} fill="#F4EEE8" stroke="#3F2A23" strokeOpacity="0.58" strokeWidth="1" /><circle cx={x} cy={y} r="2.9" fill={color} /><circle cx={x} cy={y} r="1.42" fill="#090B0E" /><circle cx={x - 0.8} cy={y - 1} r="0.62" fill="#FFFFFF" opacity="0.84" /><path d={`M${x - width} ${y - 1}q${width} ${-height - 1} ${width * 2} 1`} fill="none" stroke="#251915" strokeOpacity="0.56" /></g>;
}

function Hair({ style, hairId, palette }: { style: DriverCharacterConfiguration["hairStyle"]; hairId: string; palette: HairPalette }) {
  if (style === "BALD") return <g data-layer="hair"><path d="M114 59q26-22 52 0" fill="none" stroke={palette.light} strokeOpacity="0.15" strokeWidth="2" /><path d="M122 43q18-9 35 0" fill="none" stroke="#FFFFFF" strokeOpacity="0.09" strokeWidth="3" /></g>;
  if (style === "AFRO") return <g aria-hidden="true" data-layer="hair" fill={`url(#${hairId})`} stroke={palette.shadow} strokeOpacity="0.45" strokeWidth="1.5"><circle cx="118" cy="43" r="19" /><circle cx="137" cy="33" r="22" /><circle cx="160" cy="39" r="21" /><circle cx="171" cy="58" r="17" /><circle cx="108" cy="61" r="16" /><path d="M109 66q31-24 63-3l-5 21q-21-26-56-7Z" /></g>;
  if (style === "LONG") return <g aria-hidden="true" data-layer="hair" fill={`url(#${hairId})`} stroke={palette.shadow} strokeOpacity="0.48" strokeWidth="1.5"><path d="M108 66q1-38 31-42 34 2 35 40-12-13-22-6-30-17-44 8Z" /><path d="M109 61q-5 35 2 67l14-4-6-58Z" /><path d="M172 59q7 35-5 70l-14-5 8-59Z" /><path d="M118 47q20-15 41-4" fill="none" stroke={palette.light} strokeLinecap="round" strokeOpacity="0.34" strokeWidth="2.2" /><path d="M114 72q-2 27 3 43M166 69q3 29-3 46" fill="none" stroke={palette.light} strokeLinecap="round" strokeOpacity="0.18" strokeWidth="1.6" /></g>;
  const texture = style === "CURLY" || style === "CURLY_SHORT" ? <path d="M116 48q6-8 12 0t12 0t12 0t12 0M113 57q7-8 14 0t14 0t14 0t14 0" fill="none" stroke={palette.light} strokeOpacity="0.32" strokeWidth="2.2" /> : style === "WAVY" ? <path d="M115 49q10-10 20 0t20 0t16 2M113 58q10-9 20 0t20 0" fill="none" stroke={palette.light} strokeOpacity="0.3" strokeWidth="2.3" /> : <><path d="M118 47q20-15 41-4" fill="none" stroke={palette.light} strokeOpacity="0.34" strokeLinecap="round" strokeWidth="2.2" /><path d="M115 56q24-17 50-6" fill="none" stroke={palette.light} strokeOpacity="0.18" strokeLinecap="round" /></>;
  return <g aria-hidden="true" data-layer="hair"><path d={hairPath(style)} fill={`url(#${hairId})`} stroke={palette.shadow} strokeOpacity="0.48" strokeWidth="1.5" />{texture}{style.includes("FADE") || style === "UNDERCUT" ? <path d="M110 59v24M170 57v27" stroke={palette.shadow} strokeOpacity="0.52" strokeWidth="5" /> : null}</g>;
}

function Beard({ style, hairId }: { style: DriverCharacterConfiguration["beardStyle"]; hairId: string }) {
  if (style === "NONE") return null;
  const opacity = style === "LIGHT" ? 0.24 : style === "STUBBLE" ? 0.42 : style === "HEAVY_STUBBLE" ? 0.6 : 0.9;
  if (style === "MOUSTACHE") return <path data-layer="beard" d="M128 106q12-6 24 0-4 8-12 3-8 5-12-3Z" fill={`url(#${hairId})`} opacity={opacity} />;
  if (style === "GOATEE") return <path data-layer="beard" d="M132 106q8 5 16 0l-3 21h-10Z" fill={`url(#${hairId})`} opacity={opacity} />;
  const path = style === "LONG_FULL" ? "M113 97q2 31 10 43l17 15 17-15q8-12 10-43-9 10-14 22-13 11-26 0-5-12-14-22Z" : style === "FULL" || style === "SHORT_FULL" ? "M114 98q3 29 26 38 23-9 26-38-9 10-13 21-13 11-26 0-4-11-13-21Z" : "M117 104q5 23 23 27 18-4 23-27-9 13-23 15-14-2-23-15Z";
  return <g data-layer="beard"><path d={path} fill={`url(#${hairId})`} opacity={opacity} /><path d="M122 112q18 13 36 0" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="1.4" /></g>;
}

function Eyewear({ style }: { style: DriverCharacterConfiguration["eyewearStyle"] }) {
  if (style === "NONE") return null;
  return <g data-layer="accessory" fill={style === "SUNGLASSES" ? "#07101F" : "none"} fillOpacity="0.9" stroke={style === "SUNGLASSES" ? "#64748B" : "#CBD5E1"} strokeWidth="1.8"><rect x="117" y="80" width="22" height="17" rx="5" /><rect x="142" y="80" width="22" height="17" rx="5" /><path d="M139 86h3M116 84l-6-2M165 84l6-2" />{style === "GLASSES" ? <path d="m120 83 15 10M145 83l15 10" stroke="#FFFFFF" strokeOpacity="0.18" /> : null}</g>;
}

function FaceDetail({ detail, color }: { detail: DriverCharacterConfiguration["faceDetail"]; color: string }) {
  if (detail === "FRECKLES") return <g data-layer="details" fill={color} opacity="0.42"><circle cx="120" cy="99" r="0.8" /><circle cx="124" cy="101" r="0.7" /><circle cx="157" cy="100" r="0.8" /><circle cx="161" cy="98" r="0.7" /></g>;
  if (detail === "CHEEK_MARK") return <path data-layer="details" d="m160 99 6 5" stroke={color} strokeOpacity="0.45" strokeWidth="1.2" />;
  if (detail === "BROW_MARK") return <path data-layer="details" d="m156 72 5 7" stroke={color} strokeOpacity="0.5" strokeWidth="1.2" />;
  return null;
}

function Helmet({ configuration, x, y, visorId, shadowId, worn = false }: { configuration: DriverCharacterConfiguration; x: number; y: number; visorId: string; shadowId: string; worn?: boolean }) {
  const scale = worn ? 1.03 : 0.7;
  const pattern = configuration.helmet.pattern;
  return <g aria-hidden="true" data-layer="helmet" transform={`translate(${x} ${y}) scale(${scale}) translate(-140 -72)`} filter={`url(#${shadowId})`}><path d="M104 80q1-48 36-57 39 7 39 55l-13 36h-53Z" fill={configuration.helmet.primaryColor} stroke={configuration.helmet.accentColor} strokeWidth="3" /><path d="M110 67q30-22 62 1l-8 28h-50Z" fill={`url(#${visorId})`} stroke="#D7F4FF" strokeOpacity="0.46" strokeWidth="1.5" />{pattern === "STRIPES" ? <path d="M116 34 138 23l12 2-18 33" fill={configuration.helmet.secondaryColor} opacity="0.9" /> : null}{pattern === "CHEVRON" ? <path d="m108 52 32-18 35 19" fill="none" stroke={configuration.helmet.secondaryColor} strokeWidth="8" /> : null}{pattern === "GEOMETRIC" ? <path d="m111 38 25-13 20 8-21 19Z" fill={configuration.helmet.secondaryColor} opacity="0.9" /> : null}{pattern === "SPLIT" ? <path d="M140 23q35 9 38 55l-12 36h-26Z" fill={configuration.helmet.secondaryColor} opacity="0.76" /> : null}<path d="M114 107h51" stroke={configuration.helmet.secondaryColor} strokeWidth="4" /><path d="M104 83q36 13 74-2" fill="none" stroke={configuration.helmet.accentColor} strokeOpacity="0.72" strokeWidth="2" />{configuration.helmet.finish === "GLOSS" ? <path d="M120 37q22-13 39 1" fill="none" stroke="#FFFFFF" strokeOpacity="0.48" strokeLinecap="round" strokeWidth="3" /> : null}</g>;
}

function Trophy() { return <g aria-hidden="true" data-layer="winner-prop" transform="translate(140 57)"><path d="M-18-10h36q0 31-18 37-18-6-18-37Z" fill="#D6A928" stroke="#FFE59A" strokeWidth="2" /><path d="M-18-4q-17 0-11 16 5 10 17 6M18-4q17 0 11 16-5 10-17 6M0 27v13M-15 41h30" fill="none" stroke="#FFE59A" strokeWidth="4" strokeLinecap="round" /></g>; }
function Champagne() { return <g aria-hidden="true" data-layer="winner-prop" transform="translate(210 70) rotate(-22)"><path d="M-7-25h14l4 58H-11Z" fill="#315E3A" stroke="#D8B45B" strokeWidth="2" /><path d="M-7-25h14v13H-7Z" fill="#D8B45B" /><path d="M0-30q18-18 30-5M2-27q25-5 31 7" fill="none" stroke="#D8F4FF" strokeOpacity="0.8" strokeWidth="2" /></g>; }

function hairPath(style: DriverCharacterConfiguration["hairStyle"]): string {
  if (style === "BUZZ") return "M111 64q4-35 29-38 27 2 31 35-18-8-40-1-60 3Z";
  if (style === "FADE") return "M109 68q3-41 31-44 28 3 34 37l-18-11-43 22Z";
  if (style === "SHORT_FADE") return "M110 67q3-38 30-42 28 3 34 35l-20-8-41 19Z";
  if (style === "TEXTURED_CROP") return "M108 67q2-40 31-43 31 0 36 38l-12-5-8 8-10-8-9 7-10-7-15 14Z";
  if (style === "UNDERCUT") return "M109 69q1-40 31-44 27 2 34 34l-18-10-43 23Z";
  if (style === "CURLY" || style === "CURLY_SHORT") return style === "CURLY" ? "M107 67q-2-39 31-45 36 0 37 41-10-13-18-7-6-14-16-4-9-12-17-2-8-5-18 12Z" : "M109 65q0-35 29-41 33 0 35 36-9-10-16-5-7-11-13-2-8-9-14 1-8-4-17 11Z";
  if (style === "WAVY") return "M107 68q1-41 32-45 34 1 36 40-12-13-22-5-31-12-9 11-18 3-34 17Z";
  if (style === "SIDE_PART") return "M109 66q1-35 31-41 27 2 34 33-22-13-39-7-61 15Z";
  if (style === "SLICKED") return "M110 64q7-36 33-39 25 4 31 34-21-17-41-18-64 5Z";
  if (style === "MEDIUM") return "M108 67q1-39 31-43 32 2 35 39l-6 36-8-22q-17-18-48 1l-5 22Z";
  if (style === "STRAIGHT") return "M109 67q0-38 31-43 31 2 34 39l-8 26q-14-28-54-11Z";
  return "M110 65q3-35 30-40 29 3 34 35-20-12-42-13-64 5Z";
}

function faceShapePath(shape: DriverCharacterConfiguration["faceShape"], jaw: DriverCharacterConfiguration["jawStyle"]): string {
  const jawEnd = jaw === "SQUARE" ? "l-5 43-22 27h-16l-22-27-5-43Z" : jaw === "TAPERED" ? "l-3 43-27 32-27-32-3-43Z" : jaw === "SOFT" ? "v29q-2 35-30 44-28-9-30-44Z" : "l-4 42-26 31-26-31-4-42Z";
  if (shape === "ROUND") return `M109 60q5-34 31-36 28 2 32 36${jawEnd}`;
  if (shape === "ANGULAR") return `M111 58q6-32 29-34 26 2 30 34${jawEnd}`;
  if (shape === "NARROW") return `M115 57q4-31 25-33 22 2 25 33${jawEnd}`;
  if (shape === "WIDE") return `M105 61q6-34 35-36 31 2 36 36${jawEnd}`;
  return `M111 57q5-32 29-34 26 2 30 34${jawEnd}`;
}

function jawLinePath(style: DriverCharacterConfiguration["jawStyle"]): string {
  if (style === "SQUARE") return "M116 105q3 21 18 25h12q15-4 18-25";
  if (style === "TAPERED") return "M116 106q7 21 24 28 17-7 24-28";
  if (style === "SOFT") return "M117 108q8 20 23 23t23-23";
  return "M116 106q5 20 24 27 19-7 24-27";
}

function nosePath(style: DriverCharacterConfiguration["noseStyle"]): string {
  if (style === "WIDE") return "M139 88 135 104q5 5 13 0";
  if (style === "NARROW") return "M140 88 138 105h6";
  if (style === "SOFT") return "M139 89q-3 11-1 15 5 3 9-1";
  return "M140 88 137 104h9";
}

function mouthPath(style: DriverCharacterConfiguration["mouthStyle"]): string {
  if (style === "SMILE") return "M129 113q11 8 22 0";
  if (style === "FOCUSED") return "M130 114h20";
  if (style === "CONFIDENT") return "M130 114q11 4 21-2";
  return "M130 114q10 2 20 0";
}

function bodyDimensions(shape: DriverCharacterConfiguration["bodyShape"]): { shoulder: number; waist: number } {
  if (shape === "STRONG") return { shoulder: 14, waist: 8 };
  if (shape === "SLIM") return { shoulder: -8, waist: -7 };
  if (shape === "ATHLETIC") return { shoulder: 7, waist: -1 };
  return { shoulder: 0, waist: 0 };
}

function variantViewBox(variant: DriverCharacterVariant): string {
  if (variant === "head" || variant === "tableThumbnail") return "99 20 82 142";
  if (variant === "portrait") return "64 18 152 282";
  if (variant === "halfBody") return "36 15 208 304";
  return "0 0 280 490";
}

function gloveColor(value: DriverCharacterConfiguration["gloves"], suit: TeamSuitConfiguration): string { return value === "WHITE" ? "#E5E7EB" : value === "BLACK" ? "#111827" : suit.accentColor; }
function shoeColor(value: DriverCharacterConfiguration["shoes"], suit: TeamSuitConfiguration): string { return value === "WHITE" ? "#E5E7EB" : value === "TEAM" ? mixColor(suit.secondaryColor, suit.accentColor, 0.26) : "#0B1019"; }
function mixColor(first: string, second: string, amount: number): string {
  const parse = (value: string) => [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)];
  const [r1, g1, b1] = parse(first); const [r2, g2, b2] = parse(second);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * amount).toString(16).padStart(2, "0");
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

const DriverCharacter = memo(DriverCharacterComponent);
export default DriverCharacter;
