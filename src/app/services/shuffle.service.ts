import { SetService } from 'src/app/services/set.service';
import { CardType } from 'src/app/models/card-type';
import { ConfigurationService } from './configuration.service';
import { Configuration } from './../models/configuration';
import { Injectable } from '@angular/core';
import { Card } from '../models/card';
import { forkJoin, Observable, Subject } from 'rxjs';
import { map, withLatestFrom } from 'rxjs/operators';
import { Expansion } from '../models/expansion';
import { ChanceService } from './chance.service';
import { CardService } from './card.service';
import { Set } from '../models/set';

interface RandomizableCards {
    kingdomCards: Card[];
    events: Card[];
    landmarks: Card[];
    projects: Card[];
    ways: Card[];
}

@Injectable({
    providedIn: 'root',
})
export class ShuffleService {
    private shuffleSetTriggerSubject = new Subject<void>();
    private shuffleSingleCardTriggerSubject = new Subject<Card>();

    private randomizableCards$: Observable<RandomizableCards> = forkJoin({
        kingdomCards: this.cardService.findRandomizableKingdomCards(),
        events: this.cardService.findByCardType(CardType.Event),
        landmarks: this.cardService.findByCardType(CardType.Landmark),
        projects: this.cardService.findByCardType(CardType.Project),
        ways: this.cardService.findByCardType(CardType.Way),
    });

    constructor(
        private cardService: CardService,
        private configurationService: ConfigurationService,
        private chanceService: ChanceService,
        private setService: SetService,
    ) {
        this.initShuffleSet().subscribe();
        this.initShuffleSingleCard().subscribe();
    }

    private initShuffleSet(): Observable<void> {
        return this.shuffleSetTriggerSubject.pipe(
            withLatestFrom(
                this.randomizableCards$,
                this.configurationService.configuration$,
                (_, randomizableCards: RandomizableCards, configuration: Configuration) =>
                    this.pickRandomSet(randomizableCards, configuration),
            ),
            map((set: Set) => this.setService.updateSet(set)),
        );
    }

    private pickRandomSet(randomizableCards: RandomizableCards, configuration: Configuration): Set {
        return {
            kingdomCards: this.pickRandomCards(
                randomizableCards.kingdomCards,
                configuration.expansions,
                10,
            ),
            specialCards: [
                ...this.pickRandomCards(
                    randomizableCards.events,
                    configuration.expansions,
                    configuration.specialCardsCount.events,
                ),
                ...this.pickRandomCards(
                    randomizableCards.landmarks,
                    configuration.expansions,
                    configuration.specialCardsCount.landmarks,
                ),
                ...this.pickRandomCards(
                    randomizableCards.projects,
                    configuration.expansions,
                    configuration.specialCardsCount.projects,
                ),
                ...this.pickRandomCards(
                    randomizableCards.ways,
                    configuration.expansions,
                    configuration.specialCardsCount.ways,
                ),
            ],
        };
    }

    private initShuffleSingleCard(): Observable<void> {
        return this.shuffleSingleCardTriggerSubject.pipe(
            withLatestFrom(
                this.randomizableCards$,
                this.configurationService.configuration$,
                this.setService.set$,
                (
                    oldCard: Card,
                    randomizableCards: RandomizableCards,
                    configuration: Configuration,
                    currentSet: Set,
                ) => this.pickRandomCard(oldCard, randomizableCards, configuration, currentSet),
            ),
            map(([oldCard, newCard]) => this.setService.updateSingleCard(oldCard, newCard)),
        );
    }

    private pickRandomCard(
        oldCard: Card,
        randomizableCards: RandomizableCards,
        configuration: Configuration,
        currentSet: Set,
    ): [Card, Card] {
        const candidates = this.determineCandidatesFromOldCard(oldCard, randomizableCards);
        const cardsToIgnore = oldCard.isKingdomCard
            ? currentSet.kingdomCards
            : currentSet.specialCards;

        const newCard = this.pickRandomCards(
            candidates,
            configuration.expansions,
            1,
            cardsToIgnore,
        )[0];

        return [oldCard, newCard];
    }

    private determineCandidatesFromOldCard(
        oldCard: Card,
        randomizableCards: RandomizableCards,
    ): Card[] {
        const candidatesPerCardType: Map<CardType, Card[]> = new Map([
            [CardType.Event, randomizableCards.events],
            [CardType.Landmark, randomizableCards.landmarks],
            [CardType.Project, randomizableCards.projects],
            [CardType.Way, randomizableCards.ways],
        ]);

        for (const [cardType, candidates] of candidatesPerCardType) {
            if (oldCard.types.some((type) => type === cardType)) {
                return candidates;
            }
        }

        return randomizableCards.kingdomCards;
    }

    private pickRandomCards(
        candidates: Card[],
        expansions: Expansion[],
        count: number,
        cardsToIgnore: Card[] = [],
    ): Card[] {
        if (count === 0) {
            return [];
        }

        candidates = this.filterByExpansions(candidates, expansions);
        candidates = this.excludeCardsToIgnore(candidates, cardsToIgnore);

        return this.chanceService.pickCards(candidates, count);
    }

    private filterByExpansions(cards: Card[], expansions: Expansion[]): Card[] {
        return cards.filter((card: Card) =>
            card.expansions.some((expansion: Expansion) => expansions.includes(expansion)),
        );
    }

    private excludeCardsToIgnore(cards: Card[], cardsToIgnore: Card[]): Card[] {
        return cards.filter((card: Card) => !cardsToIgnore.includes(card));
    }

    shuffleSet(): void {
        this.shuffleSetTriggerSubject.next();
    }

    shuffleSingleCard(card: Card): void {
        this.shuffleSingleCardTriggerSubject.next(card);
    }
}
