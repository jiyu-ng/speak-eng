import { createClient } from '@supabase/supabase-js';

// 스피킹 서버 터널 URL 조회용 (모이 Supabase 프로젝트의 tracker_state 재사용).
// publishable 키는 공개되어도 안전(RLS로 보호).
const SUPABASE_URL = 'https://mdkizfamvgtaceifysvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lA7If1jf1KecJXrOFSPTJw_7ZxbTpRM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 회화 서버 터널 URL은 start-speak.sh가 이 행에 기록함 (레시피 서버와 격리된 별도 행).
export const SPEAK_CONFIG_ROW = '_speak_config';
