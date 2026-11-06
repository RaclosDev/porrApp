package com.porra.mundial;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/** Reglas de capas: los controladores hablan con servicios y los servicios no conocen la web. */
@AnalyzeClasses(packages = "com.porra.mundial", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule controllersDoNotUseRepositories = noClasses()
            .that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAPackage("..repository..")
            .because("el acceso a datos pasa por los servicios, donde viven los permisos y la privacidad");

    @ArchTest
    static final ArchRule servicesDoNotDependOnControllers = noClasses()
            .that().resideInAPackage("..service..")
            .should().dependOnClassesThat().resideInAPackage("..controller..");

    @ArchTest
    static final ArchRule repositoriesOnlyKnowTheModel = noClasses()
            .that().resideInAPackage("..repository..")
            .should().dependOnClassesThat().resideInAnyPackage("..service..", "..controller..");
}
