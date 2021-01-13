import { AppBarService } from './../../services/app-bar.service';
import { Component, OnInit } from '@angular/core';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { Router } from '@angular/router';
import { ExpansionService } from 'src/app/services/expansion.service';

@Component({
    selector: 'app-configuration',
    templateUrl: './configuration.component.html',
    styleUrls: ['./configuration.component.scss'],
    providers: [{ provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } }],
})
export class ConfigurationComponent implements OnInit {
    constructor(
        private router: Router,
        private appBarService: AppBarService,
        public expansionService: ExpansionService,
    ) {}

    ngOnInit(): void {
        this.appBarService.updateConfiguration({
            navigationAction: 'none',
            actions: [],
        });
    }

    onSubmit(): void {
        this.router.navigate(['set']);
    }
}