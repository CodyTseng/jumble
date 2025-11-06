#!/bin/bash
# Add zap-self feature to Jumble Spark
# This script enables users to zap their own notes with an easter egg warning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔧 Adding zap-self feature to Jumble Spark...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Create backups
echo -e "${GREEN}📦 Creating backups...${NC}"
cp src/components/NoteStats/ZapButton.tsx src/components/NoteStats/ZapButton.tsx.backup
cp src/components/ZapDialog/index.tsx src/components/ZapDialog/index.tsx.backup
echo -e "${GREEN}✅ Backups created${NC}\n"

# Step 1: Remove self-zap restriction in ZapButton.tsx
echo -e "${GREEN}⚡ Step 1: Enabling self-zap in ZapButton.tsx...${NC}"
echo -e "   Removing line 38: if (pubkey === profile.pubkey) return"

# Use sed to remove line 38 which contains the self-zap check
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS version
    sed -i '' '38d' src/components/NoteStats/ZapButton.tsx
else
    # Linux version
    sed -i '38d' src/components/NoteStats/ZapButton.tsx
fi

echo -e "${GREEN}✅ Self-zap enabled in ZapButton${NC}\n"

# Step 2: Add translations to all language files
echo -e "${GREEN}🌐 Step 2: Adding translations to all language files...${NC}"

# Add translation key to all locale files after the "Zaps" entry
for locale_file in src/i18n/locales/*.ts; do
    lang=$(basename "$locale_file" .ts)
    echo -e "   Adding translation for: ${lang}"

    # Translation text based on language
    case $lang in
        en)
            translation="'selfZapWarning': 'Jumble is not responsible for what happens if you zap yourself. Proceed at your own risk. 😉⚡',"
            ;;
        zh)
            translation="'selfZapWarning': 'Jumble 对您给自己打赏所发生的事情概不负责。风险自负。😉⚡',"
            ;;
        ja)
            translation="'selfZapWarning': 'Jumble は、あなたが自分自身にザップした場合の結果について責任を負いません。自己責任で続行してください。😉⚡',"
            ;;
        ko)
            translation="'selfZapWarning': 'Jumble은 자신에게 Zap을 보낼 때 발생하는 일에 대해 책임을 지지 않습니다. 본인의 책임 하에 진행하세요. 😉⚡',"
            ;;
        es)
            translation="'selfZapWarning': 'Jumble no se hace responsable de lo que suceda si te zapeas a ti mismo. Procede bajo tu propio riesgo. 😉⚡',"
            ;;
        fr)
            translation="'selfZapWarning': 'Jumble n'\''est pas responsable de ce qui se passe si vous vous zappez vous-même. Procédez à vos risques et périls. 😉⚡',"
            ;;
        de)
            translation="'selfZapWarning': 'Jumble ist nicht verantwortlich für das, was passiert, wenn Sie sich selbst zappen. Fahren Sie auf eigene Gefahr fort. 😉⚡',"
            ;;
        it)
            translation="'selfZapWarning': 'Jumble non è responsabile di ciò che accade se zappi te stesso. Procedi a tuo rischio e pericolo. 😉⚡',"
            ;;
        pt-BR|pt-PT)
            translation="'selfZapWarning': 'Jumble não é responsável pelo que acontece se você zap a si mesmo. Prossiga por sua conta e risco. 😉⚡',"
            ;;
        pl)
            translation="'selfZapWarning': 'Jumble nie ponosi odpowiedzialności za to, co się stanie, jeśli zappujesz samego siebie. Kontynuuj na własne ryzyko. 😉⚡',"
            ;;
        ru)
            translation="'selfZapWarning': 'Jumble не несет ответственности за то, что произойдет, если вы отправите zap самому себе. Продолжайте на свой страх и риск. 😉⚡',"
            ;;
        ar)
            translation="'selfZapWarning': 'Jumble غير مسؤولة عما يحدث إذا أرسلت zap لنفسك. تابع على مسؤوليتك الخاصة. 😉⚡',"
            ;;
        fa)
            translation="'selfZapWarning': 'Jumble مسئولیتی در قبال اتفاقاتی که در صورت ارسال zap به خودتان می‌افتد ندارد. با مسئولیت خود ادامه دهید. 😉⚡',"
            ;;
        hi)
            translation="'selfZapWarning': 'Jumble आपके द्वारा स्वयं को zap करने पर क्या होता है, इसके लिए जिम्मेदार नहीं है। अपनी जोखिम पर आगे बढ़ें। 😉⚡',"
            ;;
        th)
            translation="'selfZapWarning': 'Jumble ไม่รับผิดชอบต่อสิ่งที่เกิดขึ้นหากคุณ zap ตัวเอง ดำเนินการด้วยความเสี่ยงของคุณเอง 😉⚡',"
            ;;
        *)
            # Default to English for any other languages
            translation="'selfZapWarning': 'Jumble is not responsible for what happens if you zap yourself. Proceed at your own risk. 😉⚡',"
            ;;
    esac

    # Insert after the "Zaps" line
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS version - insert after line containing "Zaps:"
        sed -i '' "/Zaps: /a\\
    $translation
" "$locale_file"
    else
        # Linux version
        sed -i "/Zaps: /a\\    $translation" "$locale_file"
    fi
done

echo -e "${GREEN}✅ Translations added to all language files${NC}\n"

# Step 3: Add easter egg warning to ZapDialog
echo -e "${GREEN}🥚 Step 3: Adding easter egg warning to ZapDialog...${NC}"
echo -e "   Adding message: 'Jumble is not responsible for what happens if you zap yourself. Proceed at your own risk. 😉⚡'"

# Create a temporary file with the modified content
cat > /tmp/zapdialog-patch.js << 'PATCH_SCRIPT'
const fs = require('fs');
const filePath = 'src/components/ZapDialog/index.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add isSelfZap detection
const warningCode = `  const isSelfZap = useMemo(() => pubkey === recipient, [pubkey, recipient])
`;

// Insert after the comment state declaration (around line 141)
const insertAfterPattern = /const \[comment, setComment\] = useState\(defaultComment \?\? defaultZapComment\)/;
content = content.replace(
  insertAfterPattern,
  (match) => match + '\n' + warningCode
);

// Now add the warning UI after the <Label> for sats (around line 229)
const warningUI = `
      {/* Self-zap easter egg warning */}
      {isSelfZap && (
        <div className="text-sm text-yellow-600 dark:text-yellow-400 text-center px-4 py-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-md border border-yellow-200 dark:border-yellow-900">
          {t('selfZapWarning')}
        </div>
      )}
`;

// Insert after the Label for Sats
const insertUIPattern = /<Label htmlFor="sats">\{t\('Sats'\)\}<\/Label>\n      <\/div>/;
content = content.replace(
  insertUIPattern,
  (match) => match + '\n' + warningUI
);

// Add useMemo to imports if not already there
if (!content.includes('useMemo')) {
  content = content.replace(
    /import \{ ([^}]+) \} from 'react'/,
    (match, imports) => {
      if (!imports.includes('useMemo')) {
        return `import { ${imports}, useMemo } from 'react'`;
      }
      return match;
    }
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully patched ZapDialog');
PATCH_SCRIPT

# Run the patch script
node /tmp/zapdialog-patch.js

# Clean up
rm /tmp/zapdialog-patch.js

echo -e "${GREEN}✅ Easter egg warning added to ZapDialog${NC}\n"

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Zap-self feature successfully added!${NC}\n"
echo -e "${YELLOW}Changes made:${NC}"
echo -e "  1. ${GREEN}✓${NC} Removed self-zap restriction in ZapButton.tsx"
echo -e "  2. ${GREEN}✓${NC} Added translations to all 16 language files"
echo -e "  3. ${GREEN}✓${NC} Added easter egg warning in ZapDialog.tsx"
echo -e "\n${YELLOW}Warning message:${NC}"
echo -e "  'Jumble is not responsible for what happens if you zap yourself."
echo -e "   Proceed at your own risk. 😉⚡'"
echo -e "\n${YELLOW}Backups created:${NC}"
echo -e "  • src/components/NoteStats/ZapButton.tsx.backup"
echo -e "  • src/components/ZapDialog/index.tsx.backup"
echo -e "\n${YELLOW}To restore backups:${NC}"
echo -e "  mv src/components/NoteStats/ZapButton.tsx.backup src/components/NoteStats/ZapButton.tsx"
echo -e "  mv src/components/ZapDialog/index.tsx.backup src/components/ZapDialog/index.tsx"
echo -e "  git restore src/i18n/locales/*.ts"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
echo -e "${GREEN}🚀 Restart your dev server and try zapping your own note!${NC}"
