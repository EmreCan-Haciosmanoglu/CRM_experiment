import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSession, signOut } from "next-auth/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { User } from "../slices/registerSlice";



export interface CustomError {
  statusCode: number;
  errorName: string;
  message: string;
  data?: {
    message: string;
    field?: string;
    reason?: string;
  };
}

const baseLink = "http://localhost:3307";

const baseQuery = fetchBaseQuery({ baseUrl: baseLink });

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {

  // Get the access token from the session
  const session = await getSession();
  const accessToken = session?.user?.accessToken;

  // Add the Authorization header if token exists
  if (accessToken) {
    if (typeof args === "string") {
      args = {
        url: args,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };
    } else {
      args.headers = {
        ...args.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }
  }

  // Initial API request
  let result = await baseQuery(args, api, extraOptions);

  // Handle 401 Unauthorized errors
  if (result.error && result.error.status === 401) {
    // Attempt to refresh token (if your backend has this endpoint)
    const refreshResult = await baseQuery("/refresh", api, extraOptions);

    if (refreshResult.data) {
      // If refresh is successful, retry the original request
      result = await baseQuery(args, api, extraOptions);
    } else {
      // If refresh fails, sign out the user
      await signOut(); 
      return result; // Or throw an error to handle the failed refresh
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: "apiz",
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    createUser: builder.mutation<
    { statusCode: number; success: boolean; data: { token: string }; message: string } | CustomError,
    User
  >({ // Update the expected response type
      query: (userData) => ({
        url: "users/register",
        method: "POST",
        body: userData,
      }),
    }),
  }),
});

export const { useCreateUserMutation } = api;
