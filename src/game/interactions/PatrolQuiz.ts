import type { FestivalPassport } from './FestivalPassport';

export interface QuizQuestion {
  id: string;
  question: string;
  choices: readonly [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation: string;
}

export interface CurrentQuestionView {
  id: string;
  question: string;
  choices: readonly [string, string, string];
  index: number;
  total: number;
}

export interface AnswerFeedback {
  questionId: string;
  questionIndex: number;
  selectedChoiceIndex: number;
  correctChoiceIndex: number;
  isCorrect: boolean;
  explanation: string;
  currentScore: number;
  isQuizCompleted: boolean;
}

export interface QuizProgress {
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  isCompleted: boolean;
  score: number;
}

export interface QuizScore {
  correct: number;
  total: number;
  percentage: number;
  passed: boolean;
  isPerfect: boolean;
}

export interface PatrolQuizOptions {
  passport?: FestivalPassport;
  passingScore?: number;
  questions?: readonly QuizQuestion[];
  onQuizCompleted?: (score: QuizScore) => void;
  onAnswerSubmitted?: (feedback: AnswerFeedback) => void;
}

export const DEFAULT_PATROL_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'patrol_role',
    question: 'Czym zajmuje się Pokojowy Patrol podczas festiwalu?',
    choices: [
      'Czuwa nad bezpieczeństwem, udziela informacji i pomaga każdemu w potrzebie',
      'Wystawia mandaty karne i kontroluje bagaże przy namiotach',
      'Zajmuje się wyłącznie nagłośnieniem i oświetleniem scen',
    ],
    correctIndex: 0,
    explanation:
      'Pokojowy Patrol to wolontariusze Fundacji WOŚP, którzy dbają o bezpieczeństwo, niosą pierwszą pomoc i budują życzliwą atmosferę na całym terenie festiwalu.',
  },
  {
    id: 'medical_point',
    question:
      'Gdzie na mapie i w jakiej sytuacji należy szukać namiotu Pokojowego Patrolu / Punktu Medycznego?',
    choices: [
      'Na szczycie gondoli koła widokowego',
      'Przy głównym pasażu — w razie urazu, odwodnienia, zasłabnięcia lub zgubienia się',
      'Wyłącznie za kulisami Dużej Sceny po zakończeniu ostatniego koncertu',
    ],
    correctIndex: 1,
    explanation:
      'Główny punkt medyczny i namiot Pokojowego Patrolu znajduje się przy pasażu, zapewniając szybką i bezpłatną pomoc medyczną oraz informacyjną.',
  },
  {
    id: 'waste_segregation',
    question: 'Na czym polega festiwalowa akcja „Zaraz Będzie Czysto” i segregacja odpadów?',
    choices: [
      'Na zbiórce i segregacji puszek oraz śmieci do wyznaczonych eko-zagród recyklingowych',
      'Na zakopywaniu śmieci w wykopanych dołkach obok własnego namiotu',
      'Na znoszeniu wszystkich odpadów pod barierki sceny po koncertach',
    ],
    correctIndex: 0,
    explanation:
      'Akcja „Zaraz Będzie Czysto” uczy szacunku do przyrody — puszki i surowce wtórne oddajemy do eko-zagród, dzięki czemu pole pozostaje czyste i bezpieczne dla wszystkich.',
  },
  {
    id: 'hydration_sun',
    question: 'Jak najbezpieczniej zadbać o organizm w upalny dzień pod sceną festiwalową?',
    choices: [
      'Unikać picia jakichkolwiek płynów i stać w pełnym słońcu bez czapki',
      'Pić dużo wody z darmowych kranów/grzybka, nosić nakrycie głowy i korzystać z kurtyn wodnych',
      'Przebywać cały dzień w szczelnie zamkniętym namiocie bez wentylacji',
    ],
    correctIndex: 1,
    explanation:
      'Zabawa na słońcu grozi udarem i odwodnieniem. Podstawą jest stałe uzupełnianie wody przy darmowych kranach, orzeźwienie pod grzybkiem i ochrona głowy.',
  },
  {
    id: 'krishna_village',
    question: 'Co oferuje festiwalowiczom Pokojowa Wioska Kryszny na terenie festiwalu?',
    choices: [
      'Ciepłe, świeże posiłki wegetariańskie, warsztaty jogi, muzykę i przestrzeń wyciszenia',
      'Stację benzynową oraz płatny serwis wymiany opon ciężarowych',
      'Komercyjny lombard i punkt sprzedaży biletów lotniczych',
    ],
    correctIndex: 0,
    explanation:
      'Pokojowa Wioska Kryszny to od lat tradycyjna oaza smacznej kuchni wegetariańskiej, warsztatów, spokojnej muzyki oraz otwartego dialogu.',
  },
] as const;

export class PatrolQuiz {
  private readonly questions: readonly QuizQuestion[];
  private readonly passingScore: number;
  private readonly passport?: FestivalPassport;
  private readonly onQuizCompleted?: (score: QuizScore) => void;
  private readonly onAnswerSubmitted?: (feedback: AnswerFeedback) => void;

  private currentQuestionIndex = 0;
  private score = 0;
  private completed = false;
  private readonly answers: { questionId: string; selectedIndex: number; isCorrect: boolean }[] = [];

  constructor(options?: PatrolQuizOptions) {
    this.questions = options?.questions ?? DEFAULT_PATROL_QUESTIONS;
    this.passingScore = options?.passingScore ?? 3;
    this.passport = options?.passport;
    this.onQuizCompleted = options?.onQuizCompleted;
    this.onAnswerSubmitted = options?.onAnswerSubmitted;
  }

  /**
   * Zwraca dane pytania dla widoku UI.
   * Nie ujawnia poprawnej odpowiedzi przed udzieleniem wyboru.
   * Zwraca null, gdy quiz został ukończony.
   */
  getCurrentQuestion(): CurrentQuestionView | null {
    if (this.completed || this.currentQuestionIndex >= this.questions.length) {
      return null;
    }

    const q = this.questions[this.currentQuestionIndex];
    return {
      id: q.id,
      question: q.question,
      choices: q.choices,
      index: this.currentQuestionIndex,
      total: this.questions.length,
    };
  }

  /**
   * Zatwierdza wybraną odpowiedź (0, 1 lub 2).
   * Zwraca natychmiastowy feedback z wyjaśnieniem edukacyjnym.
   */
  submitAnswer(choiceIndex: number): AnswerFeedback {
    if (this.completed || this.currentQuestionIndex >= this.questions.length) {
      throw new Error('Quiz został już ukończony. Użyj reset(), aby rozpocząć ponownie.');
    }

    if (choiceIndex < 0 || choiceIndex > 2 || !Number.isInteger(choiceIndex)) {
      throw new RangeError(`Nieprawidłowy indeks odpowiedzi: ${choiceIndex}. Oczekiwano 0, 1 lub 2.`);
    }

    const q = this.questions[this.currentQuestionIndex];
    const isCorrect = choiceIndex === q.correctIndex;

    if (isCorrect) {
      this.score++;
    }

    this.answers.push({
      questionId: q.id,
      selectedIndex: choiceIndex,
      isCorrect,
    });

    const questionIndex = this.currentQuestionIndex;
    this.currentQuestionIndex++;
    const isQuizCompleted = this.currentQuestionIndex >= this.questions.length;

    if (isQuizCompleted) {
      this.completed = true;
    }

    const feedback: AnswerFeedback = {
      questionId: q.id,
      questionIndex,
      selectedChoiceIndex: choiceIndex,
      correctChoiceIndex: q.correctIndex,
      isCorrect,
      explanation: q.explanation,
      currentScore: this.score,
      isQuizCompleted,
    };

    if (this.onAnswerSubmitted) {
      try {
        this.onAnswerSubmitted(feedback);
      } catch {
        // Callback nie może przerwać działania quizu
      }
    }

    if (isQuizCompleted) {
      const finalScore = this.getScore();

      if (finalScore.passed && this.passport) {
        try {
          this.passport.recordEvent('patrol_quiz');
        } catch {
          // Błąd paszportu nie przerywa quizu
        }
      }

      if (this.onQuizCompleted) {
        try {
          this.onQuizCompleted(finalScore);
        } catch {
          // Błąd callbacku nie przerywa quizu
        }
      }
    }

    return feedback;
  }

  /** Zwraca stan postępu rozwiązywania pytań. */
  getProgress(): QuizProgress {
    return {
      currentQuestionIndex: this.currentQuestionIndex,
      totalQuestions: this.questions.length,
      answeredCount: this.answers.length,
      isCompleted: this.completed,
      score: this.score,
    };
  }

  /** Zwraca czy quiz dobiegł końca. */
  isCompleted(): boolean {
    return this.completed;
  }

  /** Zwraca wynik punktowy i status zaliczenia. */
  getScore(): QuizScore {
    const total = this.questions.length;
    const percentage = total > 0 ? Math.round((this.score / total) * 100) : 0;
    const passed = this.score >= this.passingScore;
    const isPerfect = total > 0 && this.score === total;

    return {
      correct: this.score,
      total,
      percentage,
      passed,
      isPerfect,
    };
  }

  /** Resetuje stan quizu do pierwszego pytania. */
  reset(): void {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.completed = false;
    this.answers.length = 0;
  }
}
