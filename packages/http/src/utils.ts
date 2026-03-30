import type {AxiosError} from "axios";

import axios from "axios";

export const isAxiosError = <T>(error: unknown): error is AxiosError<T> => axios.isAxiosError(error);
