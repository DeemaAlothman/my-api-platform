import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

/**
 * استمارة تقييم القدم والكاحل (FOOT & ANKLE ASSESSMENT FORM)
 *
 * [ ] = مصفوفة checkboxes (يمكن اختيار أكثر من قيمة)
 * ( ) = حقل نصي حر
 *
 * SubjectiveHistory keys:
 *   mainCause:           string[]  – none | unknown | acute_injury | post_surgery | chronic_overuse
 *   painLocation:        string[]  – forefoot | midfoot | rearfoot
 *   vasScore:            string    – ( ) رقم من 0-10
 *   painCharacteristics: string[]  – morning_startup | eases_with_activity | progressively_worse | night_pain | pain_at_rest
 *
 * VisualInspection keys:
 *   leftRearfootAlignment:   string[]  – varus | valgus | neutral
 *   rightRearfootAlignment:  string[]
 *   leftTooManyToes:         string[]  – negative | positive
 *   leftTooManyToesCount:    string    – ( ) عدد الأصابع
 *   rightTooManyToes:        string[]
 *   rightTooManyToesCount:   string
 *   leftArchArchitecture:    string[]  – normal | low | high
 *   rightArchArchitecture:   string[]
 *   halluxValgus:            boolean
 *   halluxValgusType:        string[]  – flexible | rigid
 *   tailorsBunion:           boolean
 *   tailorsBunionType:       string[]  – flexible | rigid
 *   hammerToes:              boolean
 *   hammerToesAffected:      string    – ( ) الأصابع المصابة
 *   clawToes:                boolean
 *   clawToesAffected:        string
 *   malletToes:              boolean
 *   malletToesAffected:      string
 *   hyperkeratosisCallus:    boolean
 *   hyperkeratosisLocation:  string    – ( ) الموقع
 *   preTrophicLesions:       boolean
 *   preTrophicLesionsNotes:  string
 *   edema:                   boolean
 *   edemaType:               string[]  – pitting | non_pitting | unilateral | bilateral
 *
 * Palpation keys (all boolean – X if tender):
 *   plantar | medial | lateral | posterior | dorsal
 *
 * RangeOfMotion keys:
 *   ankleDorsiflexion:    string[]  – normal | limited
 *   anklePlantarflexion:  string[]  – normal | limited
 *
 * DynamicAnalysis keys:
 *   leftJackTest:    string[]  – arch_forms | arch_flat
 *   rightJackTest:   string[]
 *   leftWalkingLine:  string[] – normal | inward | outward
 *   rightWalkingLine: string[]
 *
 * ShoeWearPattern keys:
 *   currentFootwear: string[]  – stability_running | minimalist | high_heel | medical | custom_orthotic
 *   outsoleWear:     string[]  – normal | lateral_supination | medial_pronation
 *
 * FootMeasurements keys (all strings – text fields):
 *   footLengthLeft | footLengthRight
 *   footWidthLeft | footWidthRight
 *   archHeightLeft | archHeightRight
 *   ballWidthLeft | ballWidthRight
 *   ballCircumferenceLeft | ballCircumferenceRight
 *   heelWidthLeft | heelWidthRight
 *   metatarsalBaseHeightLeft | metatarsalBaseHeightRight
 *   footAlignmentLeft | footAlignmentRight
 *   navicularHeightLeft | navicularHeightRight
 *   navicularDropLeft | navicularDropRight
 *   navicularHeightWithOrthoticLeft | navicularHeightWithOrthoticRight
 *   navicularDropWithOrthoticLeft | navicularDropWithOrthoticRight
 *
 * insoleType: string[] – VF01 | VF02 | ... | VF11
 */
export class CreateSessionDto {
  @IsOptional() @IsObject() subjectiveHistory?: Record<string, any>;
  @IsOptional() @IsObject() visualInspection?: Record<string, any>;
  @IsOptional() @IsObject() palpation?: Record<string, any>;
  @IsOptional() @IsObject() rangeOfMotion?: Record<string, any>;
  @IsOptional() @IsObject() dynamicAnalysis?: Record<string, any>;
  @IsOptional() @IsObject() shoeWearPattern?: Record<string, any>;
  @IsOptional() @IsObject() footMeasurements?: Record<string, any>;

  @IsOptional() @IsArray() @IsString({ each: true }) insoleType?: string[];

  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() clinicianName?: string;
  @IsOptional() @IsString() clinicianSignature?: string;
  @IsOptional() @IsString() doctorDecision?: string;
}
