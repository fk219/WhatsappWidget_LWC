export class ShowToastEvent extends CustomEvent {
    constructor(toast) {
        super('showtoast', { detail: toast });
        console.log(`[Toast ${toast.variant || 'info'}] ${toast.title}: ${toast.message}`);
    }
}
