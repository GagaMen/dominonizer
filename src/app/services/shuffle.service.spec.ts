import { TestBed } from '@angular/core/testing';

import { ConfigurationService } from './configuration.service';
import { SpyObj } from 'src/testing/spy-obj';
import { cold, getTestScheduler } from 'jasmine-marbles';
import { MathService } from './math.service';
import { CardService } from './card.service';
import { DataFixture } from 'src/testing/data-fixture';
import { SetService } from './set.service';
import { ShuffleService } from './shuffle.service';
import { CardType } from '../models/card-type';
import { Card } from '../models/card';
import { Expansion } from '../models/expansion';
import { Configuration } from '../models/configuration';

describe('ShuffleService', () => {
    let shuffleService: ShuffleService;
    let cardServiceSpy: SpyObj<CardService>;
    let configurationServiceSpy: SpyObj<ConfigurationService>;
    let mathServiceSpy: SpyObj<MathService>;
    let setServiceSpy: SpyObj<SetService>;
    let dataFixture: DataFixture;
    let configuredExpansion: Expansion;
    let nonConfiguredExpansion: Expansion;
    let configuration: Configuration;
    let kingdomCards: Card[];
    let events: Card[];
    let landmarks: Card[];
    let projects: Card[];
    let ways: Card[];
    const kingdomCardsAmountOfConfiguredExpansions = 20;
    const specialCardsAmountOfConfiguredExpansions = 5;

    function createCards(
        cardType: CardType,
        isKingdomCard: boolean,
        cardsAmountOfConfiguredExpansions: number,
    ): Card[] {
        return [
            ...dataFixture.createCards(cardsAmountOfConfiguredExpansions, {
                expansions: [configuredExpansion],
                types: [cardType],
                isKingdomCard: isKingdomCard,
            }),
            ...dataFixture.createCards(cardsAmountOfConfiguredExpansions, {
                expansions: [nonConfiguredExpansion],
                types: [cardType],
                isKingdomCard: isKingdomCard,
            }),
        ];
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: CardService,
                    useValue: jasmine.createSpyObj<CardService>('CardService', [
                        'findRandomizableKingdomCards',
                        'findByCardType',
                    ]),
                },
                {
                    provide: ConfigurationService,
                    useValue: {},
                },
                {
                    provide: MathService,
                    useValue: jasmine.createSpyObj<MathService>('MathService', ['pickRandomCards']),
                },
                {
                    provide: SetService,
                    useValue: jasmine.createSpyObj<SetService>('SetService', [
                        'updateSet',
                        'updateSingleCard',
                    ]),
                },
            ],
        });

        dataFixture = new DataFixture();

        configuredExpansion = dataFixture.createExpansion();
        nonConfiguredExpansion = dataFixture.createExpansion();
        configuration = dataFixture.createConfiguration({ expansions: [configuredExpansion] });
        kingdomCards = createCards(CardType.Action, true, kingdomCardsAmountOfConfiguredExpansions);
        events = createCards(CardType.Event, false, specialCardsAmountOfConfiguredExpansions);
        landmarks = createCards(CardType.Landmark, false, specialCardsAmountOfConfiguredExpansions);
        projects = createCards(CardType.Project, false, specialCardsAmountOfConfiguredExpansions);
        ways = createCards(CardType.Way, false, specialCardsAmountOfConfiguredExpansions);

        cardServiceSpy = TestBed.inject(CardService) as jasmine.SpyObj<CardService>;
        cardServiceSpy.findRandomizableKingdomCards.and.returnValue(
            cold('(a|)', { a: kingdomCards }),
        );
        cardServiceSpy.findByCardType
            .withArgs(CardType.Event)
            .and.returnValue(cold('(a|)', { a: events }));
        cardServiceSpy.findByCardType
            .withArgs(CardType.Landmark)
            .and.returnValue(cold('(a|)', { a: landmarks }));
        cardServiceSpy.findByCardType
            .withArgs(CardType.Project)
            .and.returnValue(cold('(a|)', { a: projects }));
        cardServiceSpy.findByCardType
            .withArgs(CardType.Way)
            .and.returnValue(cold('(a|)', { a: ways }));

        configurationServiceSpy = TestBed.inject(ConfigurationService) as jasmine.SpyObj<
            ConfigurationService
        >;
        configurationServiceSpy.configuration$ = cold('a', { a: configuration });

        mathServiceSpy = TestBed.inject(MathService) as jasmine.SpyObj<MathService>;
        mathServiceSpy.pickRandomCards.and.returnValue([]);

        setServiceSpy = TestBed.inject(SetService) as jasmine.SpyObj<SetService>;
        setServiceSpy.set$ = cold('a', { a: dataFixture.createSet() });
    });

    describe('shuffleSet', () => {
        it('should update set of SetService', () => {
            shuffleService = TestBed.inject(ShuffleService);
            getTestScheduler().flush();

            shuffleService.shuffleSet();

            expect(setServiceSpy.updateSet).toHaveBeenCalled();
        });

        it('should pick 10 random kingdom cards from configured expansions', () => {
            const kingdomCardsOfConfiguredExpansions = kingdomCards.slice(
                0,
                kingdomCardsAmountOfConfiguredExpansions,
            );
            const expected = kingdomCards.slice(0, 10);
            mathServiceSpy.pickRandomCards
                .withArgs(kingdomCardsOfConfiguredExpansions, 10, undefined)
                .and.returnValue(expected);
            shuffleService = TestBed.inject(ShuffleService);
            getTestScheduler().flush();

            shuffleService.shuffleSet();
            const set = setServiceSpy.updateSet.calls.first().args[0];

            expect(set.kingdomCards).toEqual(expected);
        });

        it('with costDistribution is not empty should pass correct card weights to MathService.pickRandomCards()', () => {
            const partialKingdomCard: Partial<Card> = {
                expansions: [configuredExpansion],
                types: [CardType.Action],
                isKingdomCard: true,
            };
            kingdomCards = [
                dataFixture.createCard({ ...partialKingdomCard, cost: 4 }),
                ...dataFixture.createCards(2, { ...partialKingdomCard, cost: 5 }),
                dataFixture.createCard({ ...partialKingdomCard, cost: 6 }),
            ];
            configuration.costDistribution = new Map<number, number>([
                [4, 1],
                [5, 2],
            ]);
            // calculation formula: cost distribution value / count of cards with equal cost
            const expected = [1 / 1, 2 / 2, 2 / 2, 0 / 1];
            cardServiceSpy.findRandomizableKingdomCards.and.returnValue(
                cold('(a|)', { a: kingdomCards }),
            );
            shuffleService = TestBed.inject(ShuffleService);
            getTestScheduler().flush();

            shuffleService.shuffleSet();
            const actual = mathServiceSpy.pickRandomCards.calls.first().args[2];

            expect(actual).toEqual(expected);
        });

        ([
            ['events', () => events],
            ['landmarks', () => landmarks],
            ['projects', () => projects],
            ['ways', () => ways],
        ] as [string, () => Card[]][]).forEach(([type, specialCards]) => {
            it(`with ${type} configured should pick corresponding number of random ${type} from configured expansions`, () => {
                const specialCardsAmount = 2;
                configuration.options = { events: 0, landmarks: 0, projects: 0, ways: 0 };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (configuration.options as any)[type] = specialCardsAmount;
                const specialCardsOfConfiguredExpansions = specialCards().slice(
                    0,
                    specialCardsAmountOfConfiguredExpansions,
                );
                const expected = specialCardsOfConfiguredExpansions.slice(0, specialCardsAmount);
                mathServiceSpy.pickRandomCards
                    .withArgs(specialCardsOfConfiguredExpansions, specialCardsAmount, undefined)
                    .and.returnValue(expected);
                shuffleService = TestBed.inject(ShuffleService);
                getTestScheduler().flush();

                shuffleService.shuffleSet();
                const set = setServiceSpy.updateSet.calls.mostRecent().args[0];

                expect(set.specialCards).toEqual(expected);
            });
        });
    });

    describe('shuffleSingleCard', () => {
        it('should update single card of SetService', () => {
            const card = dataFixture.createCard();
            shuffleService = TestBed.inject(ShuffleService);
            getTestScheduler().flush();

            shuffleService.shuffleSingleCard(card);

            expect(setServiceSpy.updateSingleCard).toHaveBeenCalled();
        });

        it('with card is kingdom card should pick different random kingdom card from configured expansions', () => {
            const kingdomCardsOfConfiguredExpansions = kingdomCards.slice(
                0,
                kingdomCardsAmountOfConfiguredExpansions,
            );
            const currentSet = dataFixture.createSet({
                kingdomCards: kingdomCardsOfConfiguredExpansions.slice(0, 10),
            });
            const candidates = kingdomCardsOfConfiguredExpansions.slice(
                10,
                kingdomCardsAmountOfConfiguredExpansions,
            );
            const expectedOldCard = currentSet.kingdomCards[0];
            const expectedNewCard = candidates[0];
            setServiceSpy.set$ = cold('a', { a: currentSet });
            mathServiceSpy.pickRandomCards
                .withArgs(candidates, 1, undefined)
                .and.returnValue([expectedNewCard]);
            shuffleService = TestBed.inject(ShuffleService);
            getTestScheduler().flush();

            shuffleService.shuffleSingleCard(expectedOldCard);
            const actualOldCard = setServiceSpy.updateSingleCard.calls.mostRecent().args[0];
            const actualNewCard = setServiceSpy.updateSingleCard.calls.mostRecent().args[1];

            expect(actualOldCard).withContext('oldCard').toEqual(expectedOldCard);
            expect(actualNewCard).withContext('newCard').toEqual(expectedNewCard);
        });

        it('with costDistribution is not empty should pass correct card weights to MathService.pickRandomCards()', () => {
            const partialKingdomCard: Partial<Card> = {
                expansions: [configuredExpansion],
                types: [CardType.Action],
                isKingdomCard: true,
            };
            kingdomCards = [
                ...dataFixture.createCards(2, { ...partialKingdomCard, cost: 4 }),
                ...dataFixture.createCards(2, { ...partialKingdomCard, cost: 5 }),
                dataFixture.createCard({ ...partialKingdomCard, cost: 6 }),
            ];
            configuration.costDistribution = new Map<number, number>([
                [4, 1],
                [5, 2],
            ]);
            const currentSet = dataFixture.createSet({
                kingdomCards: kingdomCards.slice(0, 1),
            });
            const oldCard = currentSet.kingdomCards[0];
            // calculation formula: cost distribution value / count of cards with equal cost
            const expected = [1 / 1, 2 / 2, 2 / 2, 0 / 1];
            cardServiceSpy.findRandomizableKingdomCards.and.returnValue(
                cold('(a|)', { a: kingdomCards }),
            );
            setServiceSpy.set$ = cold('a', { a: currentSet });
            shuffleService = TestBed.inject(ShuffleService);
            getTestScheduler().flush();

            shuffleService.shuffleSingleCard(oldCard);
            const actual = mathServiceSpy.pickRandomCards.calls.first().args[2];

            expect(actual).toEqual(expected);
        });

        ([
            ['event', () => events],
            ['landmark', () => landmarks],
            ['project', () => projects],
            ['way', () => ways],
        ] as [string, () => Card[]][]).forEach(([type, specialCards]) => {
            it(`with card is ${type} should pick different random ${type} from configured expansions`, () => {
                const specialCardsAmount = 2;
                const specialCardsOfConfiguredExpansions = specialCards().slice(
                    0,
                    specialCardsAmountOfConfiguredExpansions,
                );
                const currentSet = dataFixture.createSet({
                    specialCards: specialCardsOfConfiguredExpansions.slice(0, specialCardsAmount),
                });
                const candidates = specialCardsOfConfiguredExpansions.slice(
                    specialCardsAmount,
                    specialCardsAmountOfConfiguredExpansions,
                );
                const expectedOldCard = currentSet.specialCards[0];
                const expectedNewCard = candidates[0];
                setServiceSpy.set$ = cold('a', { a: currentSet });
                mathServiceSpy.pickRandomCards
                    .withArgs(candidates, 1, undefined)
                    .and.returnValue([expectedNewCard]);
                shuffleService = TestBed.inject(ShuffleService);
                getTestScheduler().flush();

                shuffleService.shuffleSingleCard(expectedOldCard);
                const actualOldCard = setServiceSpy.updateSingleCard.calls.mostRecent().args[0];
                const actualNewCard = setServiceSpy.updateSingleCard.calls.mostRecent().args[1];

                expect(actualOldCard).withContext('oldCard').toEqual(expectedOldCard);
                expect(actualNewCard).withContext('newCard').toEqual(expectedNewCard);
            });
        });
    });
});