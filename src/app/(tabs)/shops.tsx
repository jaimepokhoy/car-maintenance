import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function ShopsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('shops.title')}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('shops.comingSoon')}
      </ThemedText>
    </Screen>
  );
}
