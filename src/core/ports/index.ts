/*
 * Barrel các ports — LỚP CORE. UI và data đều import từ '@core/ports'.
 */
export type { SettingsRepo } from './settings'
export type { SessionRepo } from './sessions'
export type { VocabRepo } from './vocab'
export type { SrsRepo, SrsCardInput } from './srs'
export type { MistakeRepo } from './mistakes'
export type { ScoreRepo } from './scores'
export type { PhotoRepo } from './photos'
export type { ChatRepo } from './chat'
export type { NoteRepo } from './notes'
export type { RestoreRepo, RestorePayload, RestorePhotoInput, RestoreCardInput } from './restore'
