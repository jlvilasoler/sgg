import { useHeaderBackContext } from "../header-back";
import MainHeader from "./MainHeader";
import type { AuthUser } from "../types";
import type { TabId } from "./Header";
import type { ScreenId } from "./HomeMenu";
import { getScreenTitle } from "../utils/screen-titles";

interface Props {
  user: AuthUser;
  screen: ScreenId;
  navHistory: ScreenId[];
  onHome: () => void;
  onGoBackScreen: () => void;
  onLogout: () => void;
  onOpenCuenta: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onPasswordChanged: (message: string) => void;
  onError: (message: string) => void;
}

export default function MainHeaderNav({
  user,
  screen,
  navHistory,
  onHome,
  onGoBackScreen,
  onLogout,
  onOpenCuenta,
  onUserUpdated,
  onPasswordChanged,
  onError,
}: Props) {
  const headerBack = useHeaderBackContext();
  const headerBackStep = headerBack?.step ?? null;

  const previousScreen = navHistory.length > 0 ? navHistory[navHistory.length - 1]! : null;
  const screenBackTitle =
    previousScreen === "home" || previousScreen === null
      ? "Menú principal"
      : getScreenTitle(previousScreen as TabId);

  const backTitle = headerBackStep?.destinationLabel ?? screenBackTitle;
  const canGoBack = !!headerBackStep || (screen !== "home" && navHistory.length > 0);

  const goBack = () => {
    if (headerBackStep) {
      headerBackStep.onBack();
      return;
    }
    onGoBackScreen();
  };

  return (
    <MainHeader
      user={user}
      onHome={onHome}
      showBack={canGoBack}
      onBack={goBack}
      backTitle={backTitle}
      onLogout={onLogout}
      onOpenCuenta={onOpenCuenta}
      onUserUpdated={onUserUpdated}
      onPasswordChanged={onPasswordChanged}
      onError={onError}
    />
  );
}
