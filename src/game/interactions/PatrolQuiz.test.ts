import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatrolQuiz } from './PatrolQuiz';
import { FestivalPassport } from './FestivalPassport';

describe('PatrolQuiz', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('inicjalizuje się z 5 domyślnymi pytaniami w stanie nieukończonym', () => {
    const quiz = new PatrolQuiz();
    expect(quiz.isCompleted()).toBe(false);

    const progress = quiz.getProgress();
    expect(progress.currentQuestionIndex).toBe(0);
    expect(progress.totalQuestions).toBe(5);
    expect(progress.answeredCount).toBe(0);
    expect(progress.score).toBe(0);

    const firstQ = quiz.getCurrentQuestion();
    expect(firstQ).not.toBeNull();
    expect(firstQ?.index).toBe(0);
    expect(firstQ?.total).toBe(5);
    expect(firstQ?.choices.length).toBe(3);
    // Widok dla UI nie powinien ujawniać correctIndex
    expect((firstQ as unknown as Record<string, unknown>).correctIndex).toBeUndefined();
  });

  it('zwraca natychmiastowy feedback i edukacyjne wyjaśnienie dla poprawnej odpowiedzi', () => {
    const quiz = new PatrolQuiz();
    // Pytanie 0: correctIndex to 0
    const feedback = quiz.submitAnswer(0);

    expect(feedback.isCorrect).toBe(true);
    expect(feedback.questionIndex).toBe(0);
    expect(feedback.selectedChoiceIndex).toBe(0);
    expect(feedback.correctChoiceIndex).toBe(0);
    expect(feedback.explanation).toContain('Pokojowy Patrol');
    expect(feedback.currentScore).toBe(1);
    expect(feedback.isQuizCompleted).toBe(false);

    expect(quiz.getProgress().currentQuestionIndex).toBe(1);
    expect(quiz.getProgress().answeredCount).toBe(1);
  });

  it('zwraca natychmiastowy feedback dla błędnej odpowiedzi bez punktu', () => {
    const quiz = new PatrolQuiz();
    // Pytanie 0: correctIndex to 0, wybieramy 1 (błąd)
    const feedback = quiz.submitAnswer(1);

    expect(feedback.isCorrect).toBe(false);
    expect(feedback.selectedChoiceIndex).toBe(1);
    expect(feedback.correctChoiceIndex).toBe(0);
    expect(feedback.currentScore).toBe(0);
    expect(feedback.isQuizCompleted).toBe(false);
  });

  it('odrzuca nieprawidłowy indeks odpowiedzi', () => {
    const quiz = new PatrolQuiz();
    expect(() => quiz.submitAnswer(-1)).toThrow(RangeError);
    expect(() => quiz.submitAnswer(3)).toThrow(RangeError);
    expect(() => quiz.submitAnswer(1.5)).toThrow(RangeError);
  });

  it('przechodzi przez wszystkie 5 pytań i oznacza quiz jako ukończony', () => {
    const quiz = new PatrolQuiz();

    // Domyślne poprawne indeksy: 0, 1, 0, 1, 0
    quiz.submitAnswer(0); // Q1
    quiz.submitAnswer(1); // Q2
    quiz.submitAnswer(0); // Q3
    quiz.submitAnswer(1); // Q4
    const finalFeedback = quiz.submitAnswer(0); // Q5

    expect(finalFeedback.isQuizCompleted).toBe(true);
    expect(quiz.isCompleted()).toBe(true);
    expect(quiz.getCurrentQuestion()).toBeNull();

    const score = quiz.getScore();
    expect(score.correct).toBe(5);
    expect(score.total).toBe(5);
    expect(score.percentage).toBe(100);
    expect(score.passed).toBe(true);
    expect(score.isPerfect).toBe(true);
  });

  it('blokuje dalsze odpowiedzi po ukończeniu quizu', () => {
    const quiz = new PatrolQuiz();
    for (let i = 0; i < 5; i++) {
      quiz.submitAnswer(0);
    }
    expect(quiz.isCompleted()).toBe(true);
    expect(() => quiz.submitAnswer(0)).toThrow('Quiz został już ukończony');
  });

  it('reset() zeruje stan quizu i umożliwia ponowne rozwiązanie', () => {
    const quiz = new PatrolQuiz();
    quiz.submitAnswer(0);
    quiz.submitAnswer(1);
    expect(quiz.getProgress().answeredCount).toBe(2);

    quiz.reset();
    expect(quiz.isCompleted()).toBe(false);
    expect(quiz.getProgress().currentQuestionIndex).toBe(0);
    expect(quiz.getProgress().answeredCount).toBe(0);
    expect(quiz.getProgress().score).toBe(0);

    const q = quiz.getCurrentQuestion();
    expect(q?.index).toBe(0);
  });

  it('automatycznie przyznaje pieczątkę paszportu przy zdanym teście', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const passport = new FestivalPassport({ storageKey: 'test_patrol_passport' });
    const quiz = new PatrolQuiz({ passport, passingScore: 3 });

    // Odpowiadamy poprawnie na 3 z 5 pytań (zdany)
    quiz.submitAnswer(0); // Poprawna (1/1)
    quiz.submitAnswer(1); // Poprawna (2/2)
    quiz.submitAnswer(0); // Poprawna (3/3)
    quiz.submitAnswer(0); // Błędna (3/4)
    quiz.submitAnswer(1); // Błędna (3/5)

    expect(quiz.isCompleted()).toBe(true);
    expect(quiz.getScore().passed).toBe(true);
    expect(passport.hasStamp('patrol_quiz')).toBe(true);
  });

  it('nie przyznaje pieczątki paszportu jeśli wynik jest poniżej progu zdawalności', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const passport = new FestivalPassport({ storageKey: 'test_patrol_passport_fail' });
    const quiz = new PatrolQuiz({ passport, passingScore: 4 });

    // Uzyskujemy tylko 2 punkty na 5
    quiz.submitAnswer(0); // Poprawna (1)
    quiz.submitAnswer(0); // Błędna
    quiz.submitAnswer(0); // Poprawna (2)
    quiz.submitAnswer(0); // Błędna
    quiz.submitAnswer(1); // Błędna

    expect(quiz.isCompleted()).toBe(true);
    expect(quiz.getScore().passed).toBe(false);
    expect(passport.hasStamp('patrol_quiz')).toBe(false);
  });

  it('wywołuje zarejestrowane callbacki postępu i ukończenia', () => {
    const onAnswer = vi.fn();
    const onComplete = vi.fn();

    const quiz = new PatrolQuiz({
      onAnswerSubmitted: onAnswer,
      onQuizCompleted: onComplete,
    });

    quiz.submitAnswer(0);
    expect(onAnswer).toHaveBeenCalledTimes(1);

    for (let i = 1; i < 5; i++) {
      quiz.submitAnswer(0);
    }

    expect(onAnswer).toHaveBeenCalledTimes(5);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ total: 5, passed: expect.any(Boolean) }),
    );
  });
});
