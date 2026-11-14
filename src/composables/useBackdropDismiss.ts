export function useBackdropDismiss(onDismiss: () => void, canDismiss = () => true) {
    let pointerDownStartedOnBackdrop = false;

    const handleBackdropPointerDown = (event: PointerEvent) => {
        pointerDownStartedOnBackdrop = event.target === event.currentTarget;
    };

    const handleBackdropClick = (event: MouseEvent) => {
        const shouldDismiss = pointerDownStartedOnBackdrop && event.target === event.currentTarget;
        pointerDownStartedOnBackdrop = false;

        if (shouldDismiss && canDismiss()) {
            onDismiss();
        }
    };

    return {
        handleBackdropPointerDown,
        handleBackdropClick,
    };
}
