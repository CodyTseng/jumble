
import { ISigner, TDraftEvent } from '@/types'
import { getSerialPort, createNesigner, NesignerInterface } from 'js_nesigner_sdk'
import { getEventHash, VerifiedEvent } from 'nostr-tools';

export class NesignerSigner implements ISigner {

    private pinCode: string;

    private nesigner: NesignerInterface | null = null;

    constructor(pinCode: string) {
        this.pinCode = pinCode
    }

    async login(): Promise<string> {
        if (!this.nesigner) {
            const port = await getSerialPort()
            this.nesigner = await createNesigner(port, this.pinCode)
        }
        var pubkey = await this.nesigner.getPublicKey()
        if (pubkey == null) {
            throw new Error('Failed to get public key')
        }
        return pubkey;
    }

    async getPublicKey(): Promise<string> {
        if (!this.nesigner) {
            throw new Error('Not logged in')
        }
        var pubkey = await this.nesigner.getPublicKey()
        if (pubkey) {
            return pubkey
        }
        throw new Error('Failed to get public key')
    }

    async signEvent(draftEvent: TDraftEvent): Promise<VerifiedEvent> {
        if (!this.nesigner) {
            throw new Error('Not logged in')
        }

        const event = draftEvent as VerifiedEvent;
        event.pubkey = await this.getPublicKey();
        event.id = getEventHash(event);
        const sig = await this.nesigner.sign(event.id);
        if (sig == null) {
            throw new Error('Failed to sign event')
        }
        event.sig = sig
        return event
    }

    async nip04Encrypt(pubkey: string, plainText: string): Promise<string> {
        if (!this.nesigner) {
            throw new Error('Not logged in')
        }

        var cipherText = await this.nesigner.encrypt(pubkey, plainText);
        if (cipherText == null) {
            throw new Error('Failed to encrypt message')
        }
        return cipherText
    }

    async nip04Decrypt(pubkey: string, cipherText: string): Promise<string> {
        if (!this.nesigner) {
            throw new Error('Not logged in')
        }

        var plainText = await this.nesigner.decrypt(pubkey, cipherText);
        if (plainText == null) {
            throw new Error('Failed to decrypt message')
        }
        return plainText
    }

    async nip44Encrypt(pubkey: string, plainText: string): Promise<string> {
        if (!this.nesigner) {
            throw new Error('Not logged in')
        }

        var cipherText = await this.nesigner.encrypt(pubkey, plainText);
        if (cipherText == null) {
            throw new Error('Failed to encrypt message')
        }
        return cipherText
    }

    async nip44Decrypt(pubkey: string, cipherText: string): Promise<string> {
        if (!this.nesigner) {
            throw new Error('Not logged in')
        }

        var plainText = await this.nesigner.decrypt(pubkey, cipherText);
        if (plainText == null) {
            throw new Error('Failed to decrypt message')
        }
        return plainText
    }
}