import { z } from 'zod';

// Regex for international and standard phone numbers
// Allows optional leading '+', digits, spaces, hyphens, and parentheses
// Must have between 7 and 15 digits
const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

export const submissionSchema = z.object({
  fullName: z
    .string({ required_error: 'Full Name is required' })
    .trim()
    .min(2, { message: 'Full Name must be at least 2 characters long' })
    .max(100, { message: 'Full Name cannot exceed 100 characters' })
    .regex(/^[a-zA-Z\s.'-]+$/, { message: 'Full Name can only contain letters, spaces, hyphens, and periods' }),

  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address' })
    .max(255, { message: 'Email address is too long' }),

  mobileNumber: z
    .string({ required_error: 'Mobile number is required' })
    .trim()
    .refine((val) => {
      const digitsOnly = val.replace(/\D/g, '');
      return digitsOnly.length === 10 || (digitsOnly.length === 12 && digitsOnly.startsWith('91'));
    }, {
      message: 'Mobile number must be exactly 10 digits',
    }),

  description: z
    .string()
    .trim()
    .max(1000, { message: 'Description cannot exceed 1000 characters' })
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

