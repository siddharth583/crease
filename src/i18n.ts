import { startupPrefs, type Language } from './store/prefs.ts';

// The words on the main screens, in Hindi. Keyed by the English text, so an untranslated string simply shows in
// English. The language is fixed at start-up, like the theme.

const HI: Record<string, string> = {
  // Tabs and home
  Matches: 'मैच',
  Players: 'खिलाड़ी',
  Club: 'क्लब',
  Settings: 'सेटिंग्स',
  MATCHDAY: 'मैच डे',
  'GAME ON.': 'खेल शुरू!',
  'Score every ball. Every player’s numbers add up, match after match.': 'हर गेंद का स्कोर रखें। हर खिलाड़ी के आँकड़े हर मैच के साथ जुड़ते हैं।',
  'Start a match': 'मैच शुरू करें',
  'This season': 'इस सीज़न',
  Series: 'सीरीज़',
  'Match files': 'मैच फ़ाइलें',
  IMPORT: 'इम्पोर्ट',
  EXPORT: 'एक्सपोर्ट',
  'A match someone sent you': 'किसी का भेजा मैच',
  'PDF or match file, any matches': 'PDF या मैच फ़ाइल',
  Results: 'नतीजे',
  'Hold to delete': 'हटाने के लिए दबाए रखें',
  MATCHES: 'मैच',
  RUNS: 'रन',
  WICKETS: 'विकेट',
  'Back up your matches': 'अपने मैच का बैकअप लें',
  'Back up now': 'अभी बैकअप लें',
  // Scoring
  Wide: 'वाइड',
  'No ball': 'नो बॉल',
  Bounce: 'बाउंस',
  Bye: 'बाई',
  OUT: 'आउट',
  DOT: 'डॉट',
  FOUR: 'चौका',
  SIX: 'छक्का',
  'TAP THE RUNS OFF THIS BALL': 'इस गेंद के रन दबाएँ',
  'Who’s on strike?': 'स्ट्राइक पर कौन?',
  'And at the other end?': 'दूसरे छोर पर कौन?',
  'Next batter in': 'अगला बल्लेबाज़',
  'Opening bowler': 'पहला गेंदबाज़',
  'Who’s bowling it?': 'गेंद कौन डालेगा?',
  Wicket: 'विकेट',
  'FREE HIT': 'फ़्री हिट',
  'Only a run out counts on this ball': 'इस गेंद पर सिर्फ़ रन आउट गिना जाएगा',
  'HAT-TRICK BALL': 'हैट्रिक बॉल',
  'Full scorecard': 'पूरा स्कोरकार्ड',
  Rematch: 'दोबारा मैच',
  'Export match': 'मैच एक्सपोर्ट करें',
  'Play a super over': 'सुपर ओवर खेलें',
  'MAN OF THE MATCH': 'मैन ऑफ़ द मैच',
  'FOUR!': 'चौका!',
  'SIX!': 'छक्का!',
  'OUT!': 'आउट!',
  'FIFTY!': 'अर्धशतक!',
  'CENTURY!': 'शतक!',
  'HAT-TRICK!': 'हैट्रिक!',
  // Setup
  'One match': 'एक मैच',
  'Start match': 'मैच शुरू करें',
  'Start the series': 'सीरीज़ शुरू करें',
  Teams: 'टीमें',
  Format: 'फ़ॉर्मेट',
  'House rules': 'नियम',
  Toss: 'टॉस',
  Overs: 'ओवर',
  'Who won the toss?': 'टॉस किसने जीता?',
  'They chose to': 'उन्होंने चुना',
  Bat: 'बल्लेबाज़ी',
  Bowl: 'गेंदबाज़ी',
};

export const language: Language = startupPrefs.language;

/** The text in the chosen language, or the English if there's no translation. */
export function t(en: string): string {
  return language === 'hi' ? (HI[en] ?? en) : en;
}
