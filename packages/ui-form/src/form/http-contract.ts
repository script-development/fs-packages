/** What a form reads from a failed request: its response status and body, when there is one. */
interface FailedRequest {
    response?: {status: number; data: unknown};
}

const HTTP_UNPROCESSABLE_ENTITY = 422;

/**
 * A validation refusal: an axios error (fs-http's transport) whose response is a 422. The
 * `isAxiosError` flag is the check, not the shape: only an error the transport raised is a refusal,
 * so any other object that happens to carry `response.status` 422 is rethrown rather than taken.
 */
export const isValidationRefusal = (error: unknown): error is Required<FailedRequest> =>
    typeof error === 'object' &&
    error !== null &&
    (error as {isAxiosError?: unknown}).isAxiosError === true &&
    (error as FailedRequest).response?.status === HTTP_UNPROCESSABLE_ENTITY;
