export function useBackdropDismiss(onDismiss: any, canDismiss = () => true) {
    let pointerDownStartedOnBackdrop = false;

    const handleBackdropPointerDown = (event: any) => {
        pointerDownStartedOnBackdrop = event.target === event.currentTarget;
    };

    const handleBackdropClick = (event: any) => {
        const shouldDismiss = pointerDownStartedOnBackdrop && event.target === event.currentTarget;
        pointerDownStartedOnBackdrop = false;

        if (shouldDismiss && canDismiss()) {
            onDismiss(event);
        }
    };

    return {
        handleBackdropPointerDown,
        handleBackdropClick,
    };
}
