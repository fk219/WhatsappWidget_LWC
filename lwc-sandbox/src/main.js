import { createElement } from 'lwc';
import WhatsappWidget from 'c/whatsappWidget';

const elm = createElement('whatsapp-widget', { is: WhatsappWidget });

// Mock recordId for the component
elm.recordId = '123456789012345678'; // Example ID

document.body.appendChild(elm);
