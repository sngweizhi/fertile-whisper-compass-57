
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parse, isValid } from 'date-fns';
import { useAuth } from '@/contexts/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { upsertProfile } from '@/integrations/supabase/profiles';
import { Check } from 'lucide-react';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

// Define gender options
const genderOptions = [
    { value: 'man', label: 'I\'m a man' },
    { value: 'woman', label: 'I\'m a woman' },
    { value: 'nonbinary', label: 'Another gender' }
];

// Non-binary gender options
const nonBinaryOptions = [
    { value: 'nonbinary', label: 'Non-binary' },
    { value: 'genderqueer', label: 'Genderqueer' },
    { value: 'genderfluid', label: 'Genderfluid' },
    { value: 'agender', label: 'Agender' },
    { value: 'bigender', label: 'Bigender' },
    { value: 'other', label: 'Other' }
];

// Define goal options with icon paths
const goalOptions = [
    { 
        id: 'cycle', 
        label: 'Track my menstrual cycle', 
        icon: '/lovable-uploads/695c2bb8-bda9-4885-b9d1-3de018ee0fa2.png' 
    },
    { 
        id: 'fertility', 
        label: 'Get pregnant or optimize fertility', 
        icon: '/lovable-uploads/fb8d2406-fc6b-4b53-a2b8-289ba0aa35a2.png' 
    },
    { 
        id: 'freezing', 
        label: 'Explore egg or embryo freezing',
        icon: '/lovable-uploads/a3903eca-a189-4bd6-b0b8-3585400b138b.png'  
    },
    { 
        id: 'perimenopause', 
        label: 'Learn about perimenopause or menopause',
        icon: '/lovable-uploads/f00ab20c-6e4b-4c6c-b795-60a674519d0b.png'  
    },
    { 
        id: 'symptoms', 
        label: 'Track perimenopause symptoms',
        icon: '/lovable-uploads/30c1fe71-756c-49ec-af9b-b79768416395.png'  
    },
    { 
        id: 'body', 
        label: 'Better understand my body',
        icon: '/lovable-uploads/ef1ec621-21a3-442b-88b7-b1fe23676cdb.png'  
    },
    { 
        id: 'pain', 
        label: 'Manage chronic pelvic pain or endometriosis',
        icon: '/lovable-uploads/0b70c2b5-e4b0-4647-919d-e55a8e553e57.png'  
    },
    { 
        id: 'wellness', 
        label: 'Improve sleep, mood, or energy',
        icon: '/lovable-uploads/d3f760b4-0e5d-4060-a2eb-10d1b09b24d2.png'  
    },
    { 
        id: 'menopause', 
        label: 'Manage my transition through menopause',
        icon: '/lovable-uploads/f00ab20c-6e4b-4c6c-b795-60a674519d0b.png'  
    }
];

// Date formatter and parser
const formatDateString = (date: Date) => {
  return format(date, 'dd/MM/yyyy');
};

const parseDateString = (dateString: string): Date | null => {
  if (!dateString) return null;
  
  const parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
  return isValid(parsedDate) ? parsedDate : null;
};

// Define form schema
const nameSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
});

// Update the birthdate schema to handle string input
const birthdateSchema = z.object({
  birthdate: z.string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'Date must be in dd/mm/yyyy format' })
    .refine((date) => {
      const parsedDate = parseDateString(date);
      return parsedDate && parsedDate <= new Date() && parsedDate > new Date('1900-01-01');
    }, { message: 'Please enter a valid date between 1900 and today' }),
});

// Add a schema for goals
const goalsSchema = z.object({
  goals: z.array(z.string()).min(1, { message: 'Please select at least one goal' })
});

// Combined schema for final submission
const onboardingSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  birthdate: z.string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'Date must be in dd/mm/yyyy format' })
    .refine((date) => {
      const parsedDate = parseDateString(date);
      return parsedDate && parsedDate <= new Date() && parsedDate > new Date('1900-01-01');
    }, { message: 'Please enter a valid date between 1900 and today' }),
  gender: z.string().min(1, { message: 'Please select a gender option' }),
  goals: z.array(z.string()).min(1, { message: 'Please select at least one goal' })
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const Onboarding = () => {
    const [step, setStep] = useState(1);
    const [showNonBinaryOptions, setShowNonBinaryOptions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Initialize form
    const form = useForm<OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            name: '',
            gender: '',
            birthdate: '',
            goals: []
        },
        mode: 'onChange',
    });

    // Function to format date input with automatic slashes as user types
    const formatDateInput = (value: string) => {
        // Remove all non-digit characters
        const digits = value.replace(/\D/g, '');
        
        // Format with slashes based on input length
        if (digits.length <= 2) {
            return digits;
        } else if (digits.length <= 4) {
            return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        } else {
            return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
        }
    };

    // Log step changes
    useEffect(() => {
        console.log('[Onboarding] Step changed to:', step);
    }, [step]);

    // Debug initial render
    useEffect(() => {
        console.log('[Onboarding] Component mounted. User:', user?.id);
    }, []);

    // Update form values when selectedGoals changes
    useEffect(() => {
        // Update the form's goals field whenever selectedGoals changes
        form.setValue('goals', selectedGoals);
        
        // If we're on step 4 and have goals selected, clear any existing error
        if (step === 4 && selectedGoals.length > 0) {
            form.clearErrors('goals');
        }
        
        console.log('[DEBUG] Selected goals updated:', selectedGoals);
    }, [selectedGoals, form, step]);

    // Fixed nextStep function that validates only the current step
    const nextStep = async () => {
        console.log(`[DEBUG] nextStep called for step ${step}`);
        
        let isValid = false;
        
        // Only validate the field for the current step
        if (step === 1) {
            // For step 1, validate only the name field
            isValid = await form.trigger('name');
            console.log(`[DEBUG] Name validation result: ${isValid}`);
        } 
        else if (step === 2) {
            // For step 2, validate only the birthdate field
            isValid = await form.trigger('birthdate');
            console.log(`[DEBUG] Birthdate validation result: ${isValid}`);
        } 
        else if (step === 3) {
            // For step 3, validate only the gender field
            isValid = await form.trigger('gender');
            console.log(`[DEBUG] Gender validation result: ${isValid}`);
        }
        else if (step === 4) {
            // For step 4, check if we have selected goals
            isValid = selectedGoals.length > 0;
            console.log(`[DEBUG] Goals validation result: ${isValid}, selected goals: ${selectedGoals.length}`);
            
            if (!isValid) {
                form.setError('goals', {
                    type: 'manual',
                    message: 'Please select at least one goal'
                });
            } else {
                form.clearErrors('goals');
            }
        }
        
        // Only proceed if the current step's validation passed
        if (isValid) {
            console.log(`[DEBUG] Validation passed, advancing to step ${step + 1}`);
            setStep(prevStep => prevStep + 1);
        } else {
            console.log(`[DEBUG] Validation failed for step ${step}, not advancing`);
        }
    };

    const prevStep = () => {
        console.log(`[DEBUG] prevStep called. Current step: ${step}`);
        if (step > 1) {
            setStep(step - 1);
            console.log(`[DEBUG] Moving back to step ${step - 1}`);
        }
    };

    const handleGenderChange = (value: string) => {
        console.log(`[DEBUG] Gender changed to: ${value}`);
        form.setValue('gender', value);
        setShowNonBinaryOptions(value === 'nonbinary');
    };

    const handleNonBinaryOptionSelect = (value: string) => {
        console.log(`[DEBUG] Non-binary option selected: ${value}`);
        form.setValue('gender', value);
    };

    const toggleGoalSelection = (goalId: string) => {
        setSelectedGoals(prev => {
            const newGoals = prev.includes(goalId) 
                ? prev.filter(id => id !== goalId) 
                : [...prev, goalId];
            
            console.log(`[DEBUG] Goal ${goalId} toggled. New selected goals:`, newGoals);
            return newGoals;
        });
    };

    const onSubmit = async (values: OnboardingValues) => {
        console.log(`[DEBUG] Form submitted with values:`, values);
        
        if (!user) {
            console.error(`[DEBUG] No user found when submitting form`);
            toast({
                title: "Error",
                description: "You must be logged in to complete onboarding",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            console.log(`[DEBUG] Attempting to save profile for user:`, user.id);
            
            // Parse the date string to a Date object for database storage
            const parsedDate = parseDateString(values.birthdate);
            
            if (!parsedDate) {
                throw new Error("Invalid date format");
            }
            
            // Save user profile data to Supabase
            await upsertProfile({
                id: user.id,
                name: values.name,
                birthdate: parsedDate,
                gender: values.gender,
                onboarding_completed: true,
                goals: selectedGoals
            });

            console.log(`[DEBUG] Profile successfully saved`);
            toast({
                title: "Profile saved!",
                description: "Almost done! Let's complete your profile."
            });

            // Changed navigation destination from quiz-prompt to home (where welcome screen is shown)
            console.log(`[DEBUG] Redirecting to home page with welcome screen`);
            navigate('/home');
        } catch (error: any) {
            console.error('[DEBUG] Error saving profile:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to save your information. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Header texts for each step
    const headers = {
        1: {
            title: "Ok, let's set up your profile!",
            subtitle: "First, what's your name?"
        },
        2: {
            title: "Nice to meet you!",
            subtitle: "When's your birthday?"
        },
        3: {
            title: "Just one more thing...",
            subtitle: "Which best describes you?"
        },
        4: {
            title: "How can I help you?",
            subtitle: "Select all that apply"
        }
    };

    console.log(`[DEBUG] Rendering onboarding step:`, step);
    console.log(`[DEBUG] Form state:`, { 
        isDirty: form.formState.isDirty,
        isValid: form.formState.isValid,
        errors: form.formState.errors
    });

    return (
        <div className="fixed inset-0 w-full h-full min-h-screen flex flex-col bg-white overflow-auto">
            {/* Subtle pattern top and bottom */}
            <div className="absolute top-0 left-0 w-full h-12 bg-primary-50/30 z-0" />
            
            {/* Small logo */}
            <div className="pt-6 px-6 pb-2 z-10">
                <div className="flex justify-start">
                    <img
                        src="/lovable-uploads/eb70d7b3-a429-42b6-aa8d-6f378554327b.png"
                        alt="Genesis"
                        className="h-10 w-auto"
                    />
                </div>
            </div>

            {/* Progress indicator - subtle dots at top */}
            <div className="w-full px-6 py-2 z-10">
                <div className="flex space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full flex-1 ${i <= step ? 'bg-primary' : 'bg-gray-200'
                                }`}
                        />
                    ))}
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-auto">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col px-6 pt-8 overflow-auto"
                            >
                                <div className="mb-8">
                                    <h1 className="text-3xl font-bold mb-2">{headers[1].title}</h1>
                                    <h2 className="text-2xl font-medium text-gray-900">{headers[1].subtitle}</h2>
                                    <p className="text-gray-500 mt-2">This is how you'll appear in the app</p>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className="mb-4">
                                            <FormLabel className="text-base text-gray-700">Your name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Enter your name"
                                                    className="text-lg py-6 px-4 rounded-xl border-gray-300 h-[48px]"
                                                    {...field}
                                                    onBlur={(e) => {
                                                        field.onBlur();
                                                        form.trigger('name');
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="mt-auto pt-6 pb-10 mb-4">
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        className="w-full h-[48px] text-lg rounded-full bg-black hover:bg-gray-800 text-white"
                                        data-testid="continue-button-step1"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col px-6 pt-8 overflow-auto"
                            >
                                <div className="mb-8">
                                    <button
                                        onClick={prevStep}
                                        className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors p-2"
                                        type="button"
                                    >
                                        <ArrowLeft className="mr-1 h-4 w-4" />
                                        Back
                                    </button>
                                    <h1 className="text-3xl font-bold mb-2">{headers[2].title}</h1>
                                    <h2 className="text-2xl font-medium text-gray-900">{headers[2].subtitle}</h2>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="birthdate"
                                    render={({ field }) => (
                                        <FormItem className="mb-4">
                                            <FormLabel className="text-base text-gray-700">Your birthday</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="DD/MM/YYYY"
                                                    className="text-lg py-6 px-4 rounded-xl border-gray-300 h-[48px]"
                                                    value={field.value}
                                                    onChange={(e) => {
                                                        const formatted = formatDateInput(e.target.value);
                                                        // Only update if within valid length (10 chars for dd/mm/yyyy)
                                                        if (formatted.length <= 10) {
                                                            field.onChange(formatted);
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        field.onBlur();
                                                        form.trigger('birthdate');
                                                    }}
                                                    inputMode="numeric"
                                                />
                                            </FormControl>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Enter as: DD/MM/YYYY (e.g., 15/01/1990)
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="mt-auto pt-6 pb-10 mb-4">
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        className="w-full h-[48px] text-lg rounded-full bg-black hover:bg-gray-800 text-white"
                                        data-testid="continue-button-step2"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col px-6 pt-8 overflow-auto"
                            >
                                <div className="mb-8">
                                    <button
                                        onClick={prevStep}
                                        className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors p-2"
                                        type="button"
                                    >
                                        <ArrowLeft className="mr-1 h-4 w-4" />
                                        Back
                                    </button>
                                    <h1 className="text-3xl font-bold mb-2">{headers[3].title}</h1>
                                    <h2 className="text-2xl font-medium text-gray-900">{headers[3].subtitle}</h2>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="gender"
                                    render={({ field }) => (
                                        <FormItem className="mb-4">
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={(value) => {
                                                        handleGenderChange(value);
                                                        form.trigger('gender');
                                                    }}
                                                    defaultValue={field.value}
                                                    className="flex flex-col space-y-3"
                                                >
                                                    {genderOptions.map((option) => (
                                                        <div
                                                            key={option.value}
                                                            className={cn(
                                                                "flex items-center space-x-3 border py-4 px-4 rounded-xl transition-colors",
                                                                field.value === option.value
                                                                    ? "border-primary bg-primary-50"
                                                                    : "border-gray-300"
                                                            )}
                                                        >
                                                            <RadioGroupItem
                                                                value={option.value}
                                                                id={option.value}
                                                                className="text-primary"
                                                            />
                                                            <label
                                                                htmlFor={option.value}
                                                                className="text-lg font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                                                            >
                                                                {option.label}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </FormControl>

                                            {showNonBinaryOptions && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    transition={{ duration: 0.3 }}
                                                    className="mt-3 pl-4 space-y-3"
                                                >
                                                    <RadioGroup
                                                        onValueChange={handleNonBinaryOptionSelect}
                                                        defaultValue={field.value}
                                                        className="flex flex-col space-y-3"
                                                    >
                                                        {nonBinaryOptions.map((option) => (
                                                            <div
                                                                key={option.value}
                                                                className={cn(
                                                                    "flex items-center space-x-3 border py-3 px-3 rounded-xl transition-colors",
                                                                    field.value === option.value
                                                                        ? "border-primary bg-primary-50"
                                                                        : "border-gray-300"
                                                                )}
                                                            >
                                                                <RadioGroupItem
                                                                    value={option.value}
                                                                    id={option.value}
                                                                    className="text-primary"
                                                                />
                                                                <label
                                                                    htmlFor={option.value}
                                                                    className="text-lg font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                                                                >
                                                                    {option.label}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </motion.div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="mt-auto pt-6 pb-10 mb-4">
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        className="w-full h-[48px] text-lg rounded-full bg-black hover:bg-gray-800 text-white"
                                        data-testid="continue-button-step3"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 flex flex-col px-6 pt-8 overflow-auto"
                            >
                                <div className="mb-6">
                                    <button
                                        onClick={prevStep}
                                        className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors p-2"
                                        type="button"
                                    >
                                        <ArrowLeft className="mr-1 h-4 w-4" />
                                        Back
                                    </button>
                                    <h1 className="text-3xl font-bold mb-2">{headers[4].title}</h1>
                                    <h2 className="text-2xl font-medium text-gray-900">{headers[4].subtitle}</h2>
                                </div>

                                <div className="mb-4">
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        {goalOptions.map((goal) => (
                                            <div
                                                key={goal.id}
                                                onClick={() => toggleGoalSelection(goal.id)}
                                                className={`cursor-pointer relative flex flex-col justify-between items-center text-center p-3 rounded-xl transition-all h-[160px] ${
                                                    selectedGoals.includes(goal.id)
                                                        ? "border-2 border-primary bg-primary-50"
                                                        : "border border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                {selectedGoals.includes(goal.id) && (
                                                    <div className="absolute top-2 right-2 p-1 rounded-full bg-primary text-white">
                                                        <Check size={14} />
                                                    </div>
                                                )}
                                                
                                                {/* Goal Icon with fixed height */}
                                                <div className="flex justify-center items-center mt-2">
                                                    <img 
                                                        src={goal.icon} 
                                                        alt={goal.label} 
                                                        className="h-16 w-auto" 
                                                    />
                                                </div>
                                                
                                                {/* Goal Label with overflow handling */}
                                                <p className="text-sm font-medium line-clamp-3 mt-auto mb-1">{goal.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="goals"
                                        render={() => (
                                            <FormItem>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="mt-auto pt-6 pb-10 mb-4">
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || selectedGoals.length === 0}
                                        className="w-full h-[48px] text-lg rounded-full bg-black hover:bg-gray-800 text-white"
                                        data-testid="complete-button"
                                    >
                                        {isSubmitting ? "Saving..." : "Complete"}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </Form>
        </div>
    );
};

export default Onboarding;
