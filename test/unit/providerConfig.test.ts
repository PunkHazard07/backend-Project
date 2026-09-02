const sendTransacEmailMock = jest.fn();

jest.mock('@getbrevo/brevo', () => ({
    BrevoClient: jest.fn().mockImplementation(() => ({
        transactionalEmails: { sendTransacEmail: sendTransacEmailMock },
    })),
}));

describe('emailProvider (Brevo)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        sendTransacEmailMock.mockReset();
        process.env = {
            ...originalEnv,
            BREVO_API_KEY: 'test_api_key',
            MAIL_FROM: 'test@example.com',
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('throws at load time when BREVO_API_KEY is missing', () => {
        delete process.env.BREVO_API_KEY;
        expect(() => require('../../utils/notification/ProviderConfig')).toThrow(
            'Missing required env var: BREVO_API_KEY'
        );
    });

    it('throws at load time when MAIL_FROM is missing', () => {
        delete process.env.MAIL_FROM;
        expect(() => require('../../utils/notification/ProviderConfig')).toThrow(
            'Missing required env var: MAIL_FROM'
        );
    });

    it('sends via Brevo with the correct payload', async () => {
        sendTransacEmailMock.mockResolvedValue({ messageId: 'msg_1' });
        const { emailProvider } = require('../../utils/notification/ProviderConfig');

        await emailProvider({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' });

        expect(sendTransacEmailMock).toHaveBeenCalledWith({
            sender: { name: 'Creative Furniture', email: 'test@example.com' },
            to: [{ email: 'user@example.com' }],
            subject: 'Hi',
            htmlContent: '<p>Hi</p>',
        });
    });

    it('throws when Brevo send rejects', async () => {
        sendTransacEmailMock.mockRejectedValue(new Error('Invalid API key'));
        const { emailProvider } = require('../../utils/notification/ProviderConfig');

        await expect(
            emailProvider({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' })
        ).rejects.toThrow('Brevo send failed: Invalid API key');
    });
});